package com.ncforms.response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import com.ncforms.common.ApiException;
import com.ncforms.common.PageDto;
import com.ncforms.form.Form;
import com.ncforms.form.FormField;
import com.ncforms.form.FormService;
import com.ncforms.response.ResponseDtos.AnswerItemDto;
import com.ncforms.response.ResponseDtos.ResponseDetailDto;
import com.ncforms.response.ResponseDtos.ResponseSummaryDto;
import com.ncforms.response.ResponseDtos.SubmitResponseRequest;
import com.ncforms.response.ResponseDtos.SubmitResponseResult;

@Service
public class ResponseService {

    static final String NOT_FOUND = "Resposta não encontrada.";
    static final String REMOVED_OPTION = "(opção removida)";
    static final int MAX_PAGE_SIZE = 100;

    private final ResponseRepository responses;
    private final FormService formService;
    private final AnswerValidator answerValidator;

    public ResponseService(ResponseRepository responses, FormService formService, AnswerValidator answerValidator) {
        this.responses = responses;
        this.formService = formService;
        this.answerValidator = answerValidator;
    }

    @Transactional
    public SubmitResponseResult submit(String slug, SubmitResponseRequest request) {
        Form form = formService.getAcceptingResponses(slug);
        Map<UUID, JsonNode> values = answerValidator.validate(form.getActiveFields(), request.answers());

        Response response = new Response(form.getId());
        values.forEach(response::addAnswer);
        responses.save(response);
        return new SubmitResponseResult(response.getId());
    }

    /** Lista paginada, da mais recente para a mais antiga. */
    @Transactional(readOnly = true)
    public PageDto<ResponseSummaryDto> list(UUID ownerId, UUID formId, int page, int size) {
        formService.getOwned(ownerId, formId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Order.desc("submittedAt"), Sort.Order.desc("id")));
        Page<Response> result = responses.findByFormId(formId, pageable);

        long total = result.getTotalElements();
        long offset = (long) safePage * safeSize;
        List<ResponseSummaryDto> items = new ArrayList<>();
        List<Response> content = result.getContent();
        for (int i = 0; i < content.size(); i++) {
            Response r = content.get(i);
            items.add(new ResponseSummaryDto(r.getId(), total - offset - i, r.getSubmittedAt()));
        }
        return new PageDto<>(items, safePage, safeSize, total, result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public ResponseDetailDto get(UUID ownerId, UUID formId, UUID responseId) {
        Form form = formService.getOwned(ownerId, formId);
        Response response = responses.findByIdAndFormId(responseId, formId)
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));

        long number = responses.countBefore(formId, response.getSubmittedAt(), response.getId()) + 1;
        long total = responses.countByFormId(formId);
        UUID previousId = responses.findPreviousId(formId, response.getSubmittedAt(), response.getId()).orElse(null);
        UUID nextId = responses.findNextId(formId, response.getSubmittedAt(), response.getId()).orElse(null);

        return new ResponseDetailDto(response.getId(), number, total, response.getSubmittedAt(), previousId, nextId,
                buildItems(form, response));
    }

    @Transactional
    public void delete(UUID ownerId, UUID formId, UUID responseId) {
        formService.getOwned(ownerId, formId);
        Response response = responses.findByIdAndFormId(responseId, formId)
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
        responses.delete(response);
    }

    /**
     * Monta a lista pergunta → resposta na ordem do formulário. Campos arquivados
     * aparecem apenas se esta resposta os preencheu.
     */
    private List<AnswerItemDto> buildItems(Form form, Response response) {
        Map<UUID, JsonNode> answerByField = response.getAnswers().stream()
                .collect(Collectors.toMap(Answer::getFieldId, Answer::getValue, (a, b) -> a));
        List<AnswerItemDto> items = new ArrayList<>();
        for (FormField field : form.getFields()) {
            if (!field.getType().isInput()) {
                continue;
            }
            JsonNode value = answerByField.get(field.getId());
            if (field.isArchived() && value == null) {
                continue;
            }
            items.add(new AnswerItemDto(field.getId(), field.getLabel(), field.getType(), field.isArchived(),
                    displayValues(field, value)));
        }
        return items;
    }

    private static List<String> displayValues(FormField field, JsonNode value) {
        if (value == null || value.isNull()) {
            return List.of();
        }
        if (field.getType().hasOptions()) {
            // Inclui opções arquivadas para exibir respostas antigas.
            Map<String, String> labels = new HashMap<>();
            field.getOptions().forEach(o -> labels.put(o.getId().toString(), o.getLabel()));
            Function<JsonNode, String> toLabel = node -> labels.getOrDefault(node.asString(), REMOVED_OPTION);
            if (value.isArray()) {
                List<String> result = new ArrayList<>();
                value.forEach(node -> result.add(toLabel.apply(node)));
                return result;
            }
            return List.of(toLabel.apply(value));
        }
        return List.of(value.asString());
    }
}
