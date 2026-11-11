package com.ncforms.common;

import java.util.Map;

import org.springframework.http.HttpStatus;

/** Validation error with per-field messages (key = field id or attribute path). */
public class ValidationException extends ApiException {

    private final Map<String, String> fieldErrors;

    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(HttpStatus.BAD_REQUEST, message);
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
