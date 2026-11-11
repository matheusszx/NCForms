package com.ncforms.auth;

import java.util.UUID;

import org.springframework.security.oauth2.jwt.Jwt;

/** Extracts the authenticated user's id (claim {@code sub}) from the JWT. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
