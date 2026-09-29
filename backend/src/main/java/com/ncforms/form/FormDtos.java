package com.ncforms.form;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class FormDtos {

    private FormDtos() {
    }

    public record CreateFormRequest(@Size(max = 200) String title, @Size(max = 5000) String description) {
    }

    public record FormUpdateRequest(
            @NotBlank(message = "Informe o título do formulário.") @Size(max = 200, message = "Título muito longo.") String title,
            @Size(max = 5000, message = "Descrição muito longa.") String description,
            @NotNull @Size(max = 200, message = "Limite de 200 campos por formulário.") List<@Valid @NotNull FieldDto> fields) {
    }

    /** Campo do formulário. {@code id} nulo indica um campo novo; {@code required} ausente equivale a false. */
    public record FieldDto(
            UUID id,
            @NotNull(message = "Informe o tipo do campo.") FieldType type,
            String label,
            String helpText,
            Boolean required,
            Map<String, Object> config,
            List<@Valid @NotNull OptionDto> options) {

        static FieldDto from(FormField field) {
            List<OptionDto> options = field.getActiveOptions().stream().map(OptionDto::from).toList();
            return new FieldDto(field.getId(), field.getType(), field.getLabel(), field.getHelpText(),
                    field.isRequired(), field.getConfig(), options);
        }
    }

    /** Opção de escolha. {@code id} nulo indica uma opção nova. */
    public record OptionDto(UUID id, String label) {
        static OptionDto from(FieldOption option) {
            return new OptionDto(option.getId(), option.getLabel());
        }
    }

    public record FormSummaryDto(UUID id, String title, FormStatus status, String slug, long responseCount,
            Instant createdAt, Instant updatedAt) {

        static FormSummaryDto from(Form form, long responseCount) {
            return new FormSummaryDto(form.getId(), form.getTitle(), form.getStatus(), form.getSlug(), responseCount,
                    form.getCreatedAt(), form.getUpdatedAt());
        }
    }

    public record FormDetailDto(UUID id, String title, String description, String slug, FormStatus status,
            long responseCount, Instant createdAt, Instant updatedAt, List<FieldDto> fields) {

        static FormDetailDto from(Form form, long responseCount) {
            return new FormDetailDto(form.getId(), form.getTitle(), form.getDescription(), form.getSlug(),
                    form.getStatus(), responseCount, form.getCreatedAt(), form.getUpdatedAt(),
                    form.getActiveFields().stream().map(FieldDto::from).toList());
        }
    }

    /** Visão pública do formulário publicado (sem dados internos do dono). */
    public record PublicFormDto(String slug, String title, String description, List<FieldDto> fields) {

        static PublicFormDto from(Form form) {
            return new PublicFormDto(form.getSlug(), form.getTitle(), form.getDescription(),
                    form.getActiveFields().stream().map(FieldDto::from).toList());
        }
    }
}
