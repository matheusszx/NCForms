package com.ncforms.response;

import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import tools.jackson.databind.JsonNode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Answer to one field. {@code value} holds text, a number, an ISO date,
 * an option id (RADIO/DROPDOWN) or an array of option ids (CHECKBOX).
 */
@Entity
@Table(name = "answers")
public class Answer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "response_id", nullable = false)
    private Response response;

    @Column(name = "field_id", nullable = false)
    private UUID fieldId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode value;

    protected Answer() {
    }

    Answer(Response response, UUID fieldId, JsonNode value) {
        this.response = response;
        this.fieldId = fieldId;
        this.value = value;
    }

    public UUID getId() {
        return id;
    }

    public UUID getFieldId() {
        return fieldId;
    }

    public JsonNode getValue() {
        return value;
    }
}
