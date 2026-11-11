package com.ncforms.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import com.ncforms.common.ValidationException;
import com.ncforms.form.FieldConfig;
import com.ncforms.form.FormField;

/**
 * Validates submitted answers against the current form definition and returns
 * the normalized values to be stored. Errors are keyed by field id.
 */
@Component
public class AnswerValidator {

    static final String REQUIRED = "This question is required.";
    static final String INVALID = "Invalid answer.";
    static final String INVALID_OPTION = "Invalid option.";

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int MAX_EMAIL_LENGTH = 255;
    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    public Map<UUID, JsonNode> validate(List<FormField> fields, Map<String, JsonNode> answers) {
        Map<String, JsonNode> input = answers == null ? Map.of() : answers;
        Map<String, String> errors = new LinkedHashMap<>();
        Map<UUID, JsonNode> result = new LinkedHashMap<>();

        for (FormField field : fields) {
            if (field.isArchived() || !field.getType().isInput()) {
                continue;
            }
            String key = field.getId().toString();
            JsonNode value = input.get(key);
            if (isEmpty(value)) {
                if (field.isRequired()) {
                    errors.put(key, REQUIRED);
                }
                continue;
            }
            try {
                result.put(field.getId(), normalize(field, value));
            } catch (InvalidAnswerException e) {
                errors.put(key, e.getMessage());
            }
        }

        if (!errors.isEmpty()) {
            throw new ValidationException("Some answers need attention.", errors);
        }
        return result;
    }

    private JsonNode normalize(FormField field, JsonNode value) {
        Map<String, Object> config = field.getConfig();
        return switch (field.getType()) {
            case SHORT_TEXT, LONG_TEXT -> {
                String text = requireText(value).trim();
                int max = FieldConfig.textMaxLength(field.getType(), config);
                if (text.length() > max) {
                    throw new InvalidAnswerException("The answer must be at most " + max + " characters.");
                }
                yield JSON.stringNode(text);
            }
            case EMAIL -> {
                String email = requireText(value).trim();
                if (email.length() > MAX_EMAIL_LENGTH || !EMAIL.matcher(email).matches()) {
                    throw new InvalidAnswerException("Enter a valid email address.");
                }
                yield JSON.stringNode(email);
            }
            case NUMBER -> JSON.numberNode(validateNumber(value, config));
            case DATE -> {
                try {
                    yield JSON.stringNode(LocalDate.parse(requireText(value).trim()).toString());
                } catch (DateTimeParseException e) {
                    throw new InvalidAnswerException("Enter a valid date.");
                }
            }
            case RADIO, DROPDOWN -> {
                String optionId = requireText(value);
                if (!activeOptionIds(field).contains(optionId)) {
                    throw new InvalidAnswerException(INVALID_OPTION);
                }
                yield JSON.stringNode(optionId);
            }
            case CHECKBOX -> validateCheckbox(field, value, config);
            case LINEAR_SCALE -> JSON.numberNode(validateScale(value, config));
            case SECTION_TITLE -> throw new InvalidAnswerException(INVALID);
        };
    }

    private BigDecimal validateNumber(JsonNode value, Map<String, Object> config) {
        BigDecimal number = toDecimal(value)
                .orElseThrow(() -> new InvalidAnswerException("Enter a valid number."));
        Optional<BigDecimal> min = FieldConfig.decimal(config, FieldConfig.MIN);
        Optional<BigDecimal> max = FieldConfig.decimal(config, FieldConfig.MAX);
        if (min.isPresent() && number.compareTo(min.get()) < 0) {
            throw new InvalidAnswerException("The value must be at least " + min.get().toPlainString() + ".");
        }
        if (max.isPresent() && number.compareTo(max.get()) > 0) {
            throw new InvalidAnswerException("The value must be at most " + max.get().toPlainString() + ".");
        }
        BigDecimal stripped = number.stripTrailingZeros();
        return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
    }

    private JsonNode validateCheckbox(FormField field, JsonNode value, Map<String, Object> config) {
        if (!value.isArray()) {
            throw new InvalidAnswerException(INVALID);
        }
        Set<String> validIds = activeOptionIds(field);
        Set<String> selected = new LinkedHashSet<>();
        for (JsonNode item : value) {
            if (!item.isString() || !validIds.contains(item.asString())) {
                throw new InvalidAnswerException(INVALID_OPTION);
            }
            selected.add(item.asString());
        }
        Optional<Integer> min = FieldConfig.integer(config, FieldConfig.MIN_SELECTED);
        Optional<Integer> max = FieldConfig.integer(config, FieldConfig.MAX_SELECTED);
        if (min.isPresent() && selected.size() < min.get()) {
            throw new InvalidAnswerException("Select at least " + min.get() + " " + plural(min.get()) + ".");
        }
        if (max.isPresent() && selected.size() > max.get()) {
            throw new InvalidAnswerException("Select at most " + max.get() + " " + plural(max.get()) + ".");
        }
        ArrayNode array = JSON.arrayNode();
        selected.forEach(array::add);
        return array;
    }

    private int validateScale(JsonNode value, Map<String, Object> config) {
        int min = FieldConfig.scaleMin(config);
        int max = FieldConfig.scaleMax(config);
        BigDecimal number = toDecimal(value).orElse(null);
        if (number == null || number.stripTrailingZeros().scale() > 0
                || number.compareTo(BigDecimal.valueOf(min)) < 0 || number.compareTo(BigDecimal.valueOf(max)) > 0) {
            throw new InvalidAnswerException("Choose a value between " + min + " and " + max + ".");
        }
        return number.intValueExact();
    }

    private static Optional<BigDecimal> toDecimal(JsonNode value) {
        if (value.isNumber()) {
            return Optional.of(value.decimalValue());
        }
        if (value.isString()) {
            try {
                return Optional.of(new BigDecimal(value.asString().trim().replace(',', '.')));
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    private static Set<String> activeOptionIds(FormField field) {
        return field.getActiveOptions().stream()
                .map(o -> o.getId().toString())
                .collect(Collectors.toSet());
    }

    private static String requireText(JsonNode value) {
        if (!value.isString()) {
            throw new InvalidAnswerException(INVALID);
        }
        return value.asString();
    }

    private static boolean isEmpty(JsonNode value) {
        return value == null
                || value.isNull()
                || (value.isString() && value.asString().isBlank())
                || (value.isArray() && value.isEmpty());
    }

    private static String plural(int count) {
        return count == 1 ? "option" : "options";
    }

    private static final class InvalidAnswerException extends RuntimeException {
        InvalidAnswerException(String message) {
            super(message);
        }
    }
}
