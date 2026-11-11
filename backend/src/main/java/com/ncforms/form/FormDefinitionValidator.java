package com.ncforms.form;

import static com.ncforms.form.FieldConfig.MAX;
import static com.ncforms.form.FieldConfig.MAX_LABEL;
import static com.ncforms.form.FieldConfig.MAX_LENGTH;
import static com.ncforms.form.FieldConfig.MAX_SELECTED;
import static com.ncforms.form.FieldConfig.MIN;
import static com.ncforms.form.FieldConfig.MIN_LABEL;
import static com.ncforms.form.FieldConfig.MIN_SELECTED;
import static com.ncforms.form.FieldConfig.PLACEHOLDER;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.ncforms.common.ValidationException;
import com.ncforms.form.FormDtos.FieldDto;
import com.ncforms.form.FormDtos.OptionDto;

/**
 * Validates the structure sent by the editor and returns the normalized fields
 * (trimmed texts, settings restricted to the keys each type supports).
 * Errors use keys in the format {@code fields.<index>.<attribute>}.
 */
@Component
public class FormDefinitionValidator {

    static final int MAX_LABEL_LENGTH = 500;
    static final int MAX_OPTIONS = 100;
    static final int MAX_CONFIG_TEXT_LENGTH = 200;

    private static final Set<String> TEXT_KEYS = Set.of(PLACEHOLDER, MIN_LABEL, MAX_LABEL);

    private static final Map<FieldType, Set<String>> ALLOWED_CONFIG = Map.of(
            FieldType.SECTION_TITLE, Set.of(),
            FieldType.SHORT_TEXT, Set.of(PLACEHOLDER, MAX_LENGTH),
            FieldType.LONG_TEXT, Set.of(PLACEHOLDER, MAX_LENGTH),
            FieldType.EMAIL, Set.of(PLACEHOLDER),
            FieldType.NUMBER, Set.of(PLACEHOLDER, MIN, MAX),
            FieldType.DATE, Set.of(),
            FieldType.RADIO, Set.of(),
            FieldType.CHECKBOX, Set.of(MIN_SELECTED, MAX_SELECTED),
            FieldType.DROPDOWN, Set.of(),
            FieldType.LINEAR_SCALE, Set.of(MIN, MAX, MIN_LABEL, MAX_LABEL));

    public List<FieldDto> validate(List<FieldDto> fields) {
        Map<String, String> errors = new LinkedHashMap<>();
        List<FieldDto> normalized = new ArrayList<>();
        for (int i = 0; i < fields.size(); i++) {
            normalized.add(validateField(fields.get(i), "fields." + i + ".", errors));
        }
        if (!errors.isEmpty()) {
            throw new ValidationException("Please review the highlighted form fields.", errors);
        }
        return normalized;
    }

    private FieldDto validateField(FieldDto field, String prefix, Map<String, String> errors) {
        FieldType type = field.type();
        String label = trimToNull(field.label());
        if (label == null) {
            errors.put(prefix + "label", type == FieldType.SECTION_TITLE
                    ? "Enter the section title."
                    : "Enter the question text.");
        } else if (label.length() > MAX_LABEL_LENGTH) {
            errors.put(prefix + "label", "Text is too long (max. " + MAX_LABEL_LENGTH + " characters).");
        }

        List<OptionDto> options = type.hasOptions() ? validateOptions(field.options(), prefix, errors) : List.of();
        Map<String, Object> config = validateConfig(type, field.config(), options.size(), prefix, errors);

        return new FieldDto(field.id(), type, label, trimToNull(field.helpText()),
                type.isInput() && Boolean.TRUE.equals(field.required()), config, options);
    }

    private List<OptionDto> validateOptions(List<OptionDto> options, String prefix, Map<String, String> errors) {
        if (options == null || options.isEmpty()) {
            errors.put(prefix + "options", "Add at least one option.");
            return List.of();
        }
        if (options.size() > MAX_OPTIONS) {
            errors.put(prefix + "options", "Limit of " + MAX_OPTIONS + " options per question.");
        }
        List<OptionDto> result = new ArrayList<>();
        for (OptionDto option : options) {
            String label = trimToNull(option.label());
            if (label == null) {
                errors.putIfAbsent(prefix + "options", "All options need a label.");
            } else if (label.length() > MAX_LABEL_LENGTH) {
                errors.putIfAbsent(prefix + "options", "Option label is too long.");
            }
            result.add(new OptionDto(option.id(), label));
        }
        return result;
    }

    private Map<String, Object> validateConfig(FieldType type, Map<String, Object> raw, int optionCount,
            String prefix, Map<String, String> errors) {
        Map<String, Object> config = new HashMap<>();
        if (raw != null) {
            for (String key : ALLOWED_CONFIG.get(type)) {
                Object value = raw.get(key);
                if (value == null || (value instanceof String s && s.isBlank())) {
                    continue;
                }
                if (TEXT_KEYS.contains(key)) {
                    String text = value.toString().trim();
                    if (text.length() > MAX_CONFIG_TEXT_LENGTH) {
                        errors.put(prefix + "config", "Setting text is too long.");
                    }
                    config.put(key, text);
                } else if (value instanceof Number) {
                    config.put(key, value);
                } else {
                    errors.put(prefix + "config", "Invalid setting: \"" + key + "\" must be numeric.");
                }
            }
        }
        String error = switch (type) {
            case SHORT_TEXT, LONG_TEXT -> checkMaxLength(type, config);
            case NUMBER -> checkNumberRange(config);
            case CHECKBOX -> checkSelectionLimits(config, optionCount);
            case LINEAR_SCALE -> checkScale(config);
            default -> null;
        };
        if (error != null) {
            errors.put(prefix + "config", error);
        }
        return config;
    }

    private static String checkMaxLength(FieldType type, Map<String, Object> config) {
        Optional<Integer> max = FieldConfig.integer(config, MAX_LENGTH);
        int limit = type == FieldType.LONG_TEXT
                ? FieldConfig.DEFAULT_LONG_TEXT_MAX_LENGTH
                : FieldConfig.DEFAULT_SHORT_TEXT_MAX_LENGTH;
        if (max.isPresent() && (max.get() < 1 || max.get() > limit)) {
            return "The character limit must be between 1 and " + limit + ".";
        }
        return null;
    }

    private static String checkNumberRange(Map<String, Object> config) {
        Optional<BigDecimal> min = FieldConfig.decimal(config, MIN);
        Optional<BigDecimal> max = FieldConfig.decimal(config, MAX);
        if (min.isPresent() && max.isPresent() && min.get().compareTo(max.get()) > 0) {
            return "The minimum value cannot be greater than the maximum.";
        }
        return null;
    }

    private static String checkSelectionLimits(Map<String, Object> config, int optionCount) {
        Optional<Integer> min = FieldConfig.integer(config, MIN_SELECTED);
        Optional<Integer> max = FieldConfig.integer(config, MAX_SELECTED);
        if (min.isPresent() && (min.get() < 0 || min.get() > optionCount)) {
            return "The minimum selections must be between 0 and the number of options.";
        }
        if (max.isPresent() && (max.get() < 1 || max.get() > optionCount)) {
            return "The maximum selections must be between 1 and the number of options.";
        }
        if (min.isPresent() && max.isPresent() && min.get() > max.get()) {
            return "The minimum selections cannot be greater than the maximum.";
        }
        return null;
    }

    private static String checkScale(Map<String, Object> config) {
        int min = FieldConfig.scaleMin(config);
        int max = FieldConfig.scaleMax(config);
        if (min < 0 || min > 1) {
            return "The scale must start at 0 or 1.";
        }
        if (max < 2 || max > 10) {
            return "The scale must end between 2 and 10.";
        }
        return null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
