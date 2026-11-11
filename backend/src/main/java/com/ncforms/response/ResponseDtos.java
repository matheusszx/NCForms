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

    /** Answers submitted through the public form, keyed by field id. */
    public record SubmitResponseRequest(@NotNull Map<String, JsonNode> answers) {
    }

    public record SubmitResponseResult(UUID id) {
    }

    /** {@code number} is the chronological position of the response (1 = first received). */
    public record ResponseSummaryDto(UUID id, long number, Instant submittedAt) {
    }

    public record ResponseDetailDto(UUID id, long number, long total, Instant submittedAt, UUID previousId,
            UUID nextId, List<AnswerItemDto> items) {
    }

    /**
     * Question and answer ready for display. Empty {@code values} = no answer;
     * for options, it contains the labels of the chosen options.
     */
    public record AnswerItemDto(UUID fieldId, String label, FieldType type, boolean archived, List<String> values) {
    }
}
