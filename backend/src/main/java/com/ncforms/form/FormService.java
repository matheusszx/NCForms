package com.ncforms.form;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ncforms.common.ApiException;
import com.ncforms.form.FormDtos.CreateFormRequest;
import com.ncforms.form.FormDtos.FieldDto;
import com.ncforms.form.FormDtos.FormDetailDto;
import com.ncforms.form.FormDtos.FormSummaryDto;
import com.ncforms.form.FormDtos.FormUpdateRequest;
import com.ncforms.form.FormDtos.OptionDto;
import com.ncforms.form.FormDtos.PublicFormDto;
import com.ncforms.response.AnswerRepository;
import com.ncforms.response.ResponseRepository;
import com.ncforms.response.ResponseRepository.FormResponseCount;

@Service
public class FormService {

    static final String DEFAULT_TITLE = "Untitled form";
    static final String NOT_FOUND = "Form not found.";
    static final String CLOSED = "This form is no longer accepting responses.";

    private final FormRepository forms;
    private final ResponseRepository responses;
    private final AnswerRepository answers;
    private final FormDefinitionValidator definitionValidator;
    private final SlugGenerator slugGenerator;

    public FormService(FormRepository forms, ResponseRepository responses, AnswerRepository answers,
            FormDefinitionValidator definitionValidator, SlugGenerator slugGenerator) {
        this.forms = forms;
        this.responses = responses;
        this.answers = answers;
        this.definitionValidator = definitionValidator;
        this.slugGenerator = slugGenerator;
    }

    @Transactional(readOnly = true)
    public List<FormSummaryDto> list(UUID ownerId) {
        List<Form> owned = forms.findByOwnerIdOrderByUpdatedAtDesc(ownerId);
        if (owned.isEmpty()) {
            return List.of();
        }
        Map<UUID, Long> counts = responses.countByFormIds(owned.stream().map(Form::getId).toList()).stream()
                .collect(Collectors.toMap(FormResponseCount::getFormId, FormResponseCount::getTotal));
        return owned.stream()
                .map(f -> FormSummaryDto.from(f, counts.getOrDefault(f.getId(), 0L)))
                .toList();
    }

    @Transactional
    public FormDetailDto create(UUID ownerId, CreateFormRequest request) {
        String title = request == null || request.title() == null || request.title().isBlank()
                ? DEFAULT_TITLE
                : request.title().trim();
        Form form = new Form(ownerId, title, slugGenerator.generate(forms::existsBySlug));
        if (request != null) {
            form.setDescription(blankToNull(request.description()));
        }
        forms.saveAndFlush(form);
        return FormDetailDto.from(form, 0);
    }

    @Transactional(readOnly = true)
    public FormDetailDto get(UUID ownerId, UUID formId) {
        Form form = getOwned(ownerId, formId);
        return FormDetailDto.from(form, responses.countByFormId(formId));
    }

    /**
     * Saves the complete form structure. Fields/options are matched by id;
     * removed items that already have answers are archived to preserve history.
     */
    @Transactional
    public FormDetailDto update(UUID ownerId, UUID formId, FormUpdateRequest request) {
        Form form = getOwned(ownerId, formId);
        List<FieldDto> fields = definitionValidator.validate(request.fields());

        form.setTitle(request.title().trim());
        form.setDescription(blankToNull(request.description()));
        syncFields(form, fields);
        form.touch();
        forms.saveAndFlush(form);
        return FormDetailDto.from(form, responses.countByFormId(formId));
    }

    @Transactional
    public FormDetailDto publish(UUID ownerId, UUID formId) {
        Form form = getOwned(ownerId, formId);
        boolean hasQuestion = form.getActiveFields().stream().anyMatch(f -> f.getType().isInput());
        if (!hasQuestion) {
            throw ApiException.badRequest("Add at least one question before publishing.");
        }
        form.setStatus(FormStatus.PUBLISHED);
        form.touch();
        return FormDetailDto.from(form, responses.countByFormId(formId));
    }

    @Transactional
    public FormDetailDto close(UUID ownerId, UUID formId) {
        Form form = getOwned(ownerId, formId);
        if (form.getStatus() == FormStatus.DRAFT) {
            throw ApiException.badRequest("Only published forms can be closed.");
        }
        form.setStatus(FormStatus.CLOSED);
        form.touch();
        return FormDetailDto.from(form, responses.countByFormId(formId));
    }

    @Transactional
    public void delete(UUID ownerId, UUID formId) {
        forms.delete(getOwned(ownerId, formId));
    }

    @Transactional(readOnly = true)
    public PublicFormDto getPublic(String slug) {
        return PublicFormDto.from(getAcceptingResponses(slug));
    }

    /** Form owned by the given user; also 404 when it belongs to another user (doesn't reveal existence). */
    @Transactional(readOnly = true)
    public Form getOwned(UUID ownerId, UUID formId) {
        return forms.findByIdAndOwnerId(formId, ownerId)
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    /** Published form by its public link; drafts don't exist publicly and closed forms return 410. */
    @Transactional(readOnly = true)
    public Form getAcceptingResponses(String slug) {
        Form form = forms.findBySlug(slug)
                .filter(f -> f.getStatus() != FormStatus.DRAFT)
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
        if (form.getStatus() == FormStatus.CLOSED) {
            throw ApiException.gone(CLOSED);
        }
        return form;
    }

    private void syncFields(Form form, List<FieldDto> dtos) {
        Map<UUID, FormField> existing = form.getActiveFields().stream()
                .collect(Collectors.toMap(FormField::getId, Function.identity()));
        Set<UUID> kept = new HashSet<>();
        int position = 0;

        for (FieldDto dto : dtos) {
            FormField field = dto.id() == null ? null : existing.get(dto.id());
            if (field != null && kept.contains(field.getId())) {
                field = null; // duplicate id in the payload: treat as a new field
            }
            if (field != null && field.getType() != dto.type()) {
                if (answers.existsByFieldId(field.getId())) {
                    // Changing the type would invalidate old answers: archive the old field and create a new one.
                    field = null;
                } else {
                    field.setType(dto.type());
                }
            }
            if (field == null) {
                field = new FormField(dto.type());
                form.addField(field);
            } else {
                kept.add(field.getId());
            }
            field.setPosition(position++);
            field.setLabel(dto.label());
            field.setHelpText(dto.helpText());
            field.setRequired(Boolean.TRUE.equals(dto.required()));
            field.setConfig(dto.config());
            syncOptions(field, dto.options());
        }

        for (FormField old : existing.values()) {
            if (kept.contains(old.getId())) {
                continue;
            }
            if (answers.existsByFieldId(old.getId())) {
                old.setArchived(true);
            } else {
                form.removeField(old);
            }
        }
    }

    private void syncOptions(FormField field, List<OptionDto> dtos) {
        Map<UUID, FieldOption> existing = new HashMap<>();
        field.getActiveOptions().forEach(o -> existing.put(o.getId(), o));
        Set<UUID> kept = new HashSet<>();
        int position = 0;

        for (OptionDto dto : dtos) {
            FieldOption option = dto.id() == null ? null : existing.get(dto.id());
            if (option != null && !kept.add(option.getId())) {
                option = null;
            }
            if (option == null) {
                option = new FieldOption(dto.label());
                field.addOption(option);
            } else {
                option.setLabel(dto.label());
            }
            option.setPosition(position++);
        }

        if (kept.size() == existing.size()) {
            return;
        }
        boolean hasAnswers = field.getId() != null && answers.existsByFieldId(field.getId());
        for (FieldOption old : existing.values()) {
            if (kept.contains(old.getId())) {
                continue;
            }
            if (hasAnswers) {
                old.setArchived(true);
            } else {
                field.removeOption(old);
            }
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
