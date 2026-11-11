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
            @NotBlank(message = "Enter your name.") @Size(max = 120, message = "Name is too long.") String name,
            @NotBlank(message = "Enter your email.") @Email(message = "Invalid email address.") @Size(max = 255) String email,
            @NotBlank(message = "Enter your password.") @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters.") String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email.") String email,
            @NotBlank(message = "Enter your password.") String password) {
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
