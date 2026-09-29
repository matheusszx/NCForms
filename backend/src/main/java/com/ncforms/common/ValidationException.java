package com.ncforms.common;

import java.util.Map;

import org.springframework.http.HttpStatus;

/** Erro de validação com mensagens por campo (chave = id do campo ou caminho do atributo). */
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
