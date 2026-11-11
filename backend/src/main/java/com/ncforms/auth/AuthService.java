package com.ncforms.auth;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ncforms.auth.AuthDtos.AuthResponse;
import com.ncforms.auth.AuthDtos.LoginRequest;
import com.ncforms.auth.AuthDtos.RegisterRequest;
import com.ncforms.auth.AuthDtos.UserDto;
import com.ncforms.common.ApiException;
import com.ncforms.config.AppProperties;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final AppProperties props;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder,
            AppProperties props) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.props = props;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (!props.registrationEnabled()) {
            throw ApiException.forbidden("New user registration is disabled.");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("An account with this email already exists.");
        }
        User user = users.save(new User(request.name().trim(), email, passwordEncoder.encode(request.password())));
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = users.findByEmail(normalizeEmail(request.email()))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password."));
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        return users.findById(userId)
                .map(UserDto::from)
                .orElseThrow(() -> ApiException.unauthorized("Invalid session."));
    }

    private AuthResponse issueToken(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(props.jwt().expiration());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("ncforms")
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("name", user.getName())
                .claim("email", user.getEmail())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AuthResponse(token, expiresAt, UserDto.from(user));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
