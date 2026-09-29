package com.ncforms.response;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import tools.jackson.databind.JsonNode;
import com.ncforms.form.FieldType;

import jakarta.validation.constraints.NotNull;

public final class ResponseDtos {

    private ResponseDtos() {
    }

    /** Respostas enviadas pelo formulário público, indexadas pelo id do campo. */
    public record SubmitResponseRequest(@NotNull Map<String, JsonNode> answers) {
    }

    public record SubmitResponseResult(UUID id) {
    }

    /** {@code number} é a posição cronológica da resposta (1 = primeira recebida). */
    public record ResponseSummaryDto(UUID id, long number, Instant submittedAt) {
    }

    public record ResponseDetailDto(UUID id, long number, long total, Instant submittedAt, UUID previousId,
            UUID nextId, List<AnswerItemDto> items) {
    }

    /**
     * Pergunta e resposta prontas para exibição. {@code values} vazio = sem resposta;
     * para opções, contém os textos das opções escolhidas.
     */
    public record AnswerItemDto(UUID fieldId, String label, FieldType type, boolean archived, List<String> values) {
    }
}
