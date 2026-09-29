package com.ncforms.auth;

import java.util.UUID;

import org.springframework.security.oauth2.jwt.Jwt;

/** Extrai o id do usuário autenticado (claim {@code sub}) do JWT. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
