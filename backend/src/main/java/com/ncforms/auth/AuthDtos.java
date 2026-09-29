package com.ncforms.auth;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Informe seu nome.") @Size(max = 120, message = "Nome muito longo.") String name,
            @NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.") @Size(max = 255) String email,
            @NotBlank(message = "Informe a senha.") @Size(min = 8, max = 72, message = "A senha deve ter entre 8 e 72 caracteres.") String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "Informe o e-mail.") String email,
            @NotBlank(message = "Informe a senha.") String password) {
    }

    public record UserDto(UUID id, String name, String email) {
        static UserDto from(User user) {
            return new UserDto(user.getId(), user.getName(), user.getEmail());
        }
    }

    public record AuthResponse(String token, Instant expiresAt, UserDto user) {
    }

    public record AuthConfig(boolean registrationEnabled) {
    }
}
