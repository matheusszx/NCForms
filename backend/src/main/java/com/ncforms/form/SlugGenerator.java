package com.ncforms.form;

import java.security.SecureRandom;
import java.util.function.Predicate;

import org.springframework.stereotype.Component;

/** Generates short, non-sequential identifiers for public links. */
@Component
public class SlugGenerator {

    private static final String ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int LENGTH = 10;
    private static final int MAX_ATTEMPTS = 10;

    private final SecureRandom random = new SecureRandom();

    public String generate(Predicate<String> alreadyExists) {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String slug = randomSlug();
            if (!alreadyExists.test(slug)) {
                return slug;
            }
        }
        throw new IllegalStateException("Could not generate a unique link.");
    }

    private String randomSlug() {
        StringBuilder sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
