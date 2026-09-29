package com.ncforms.common;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApiError(int status, String message, Map<String, String> fieldErrors) {

    public ApiError(int status, String message) {
        this(status, message, Map.of());
    }
}
