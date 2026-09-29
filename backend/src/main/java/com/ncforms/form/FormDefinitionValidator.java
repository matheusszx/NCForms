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
 * Valida a estrutura enviada pelo editor e devolve os campos normalizados
 * (textos aparados, configurações restritas às chaves suportadas por cada tipo).
 * Erros usam chaves no formato {@code fields.<índice>.<atributo>}.
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
            throw new ValidationException("Revise os campos destacados do formulário.", errors);
        }
        return normalized;
    }

    private FieldDto validateField(FieldDto field, String prefix, Map<String, String> errors) {
        FieldType type = field.type();
        String label = trimToNull(field.label());
        if (label == null) {
            errors.put(prefix + "label", type == FieldType.SECTION_TITLE
                    ? "Informe o título da seção."
                    : "Informe o texto da pergunta.");
        } else if (label.length() > MAX_LABEL_LENGTH) {
            errors.put(prefix + "label", "Texto muito longo (máx. " + MAX_LABEL_LENGTH + " caracteres).");
        }

        List<OptionDto> options = type.hasOptions() ? validateOptions(field.options(), prefix, errors) : List.of();
        Map<String, Object> config = validateConfig(type, field.config(), options.size(), prefix, errors);

        return new FieldDto(field.id(), type, label, trimToNull(field.helpText()),
                type.isInput() && Boolean.TRUE.equals(field.required()), config, options);
    }

    private List<OptionDto> validateOptions(List<OptionDto> options, String prefix, Map<String, String> errors) {
        if (options == null || options.isEmpty()) {
            errors.put(prefix + "options", "Adicione pelo menos uma opção.");
            return List.of();
        }
        if (options.size() > MAX_OPTIONS) {
            errors.put(prefix + "options", "Limite de " + MAX_OPTIONS + " opções por pergunta.");
        }
        List<OptionDto> result = new ArrayList<>();
        for (OptionDto option : options) {
            String label = trimToNull(option.label());
            if (label == null) {
                errors.putIfAbsent(prefix + "options", "Todas as opções precisam de um texto.");
            } else if (label.length() > MAX_LABEL_LENGTH) {
                errors.putIfAbsent(prefix + "options", "Texto de opção muito longo.");
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
                        errors.put(prefix + "config", "Texto de configuração muito longo.");
                    }
                    config.put(key, text);
                } else if (value instanceof Number) {
                    config.put(key, value);
                } else {
                    errors.put(prefix + "config", "Configuração inválida: \"" + key + "\" deve ser numérico.");
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
            return "O limite de caracteres deve estar entre 1 e " + limit + ".";
        }
        return null;
    }

    private static String checkNumberRange(Map<String, Object> config) {
        Optional<BigDecimal> min = FieldConfig.decimal(config, MIN);
        Optional<BigDecimal> max = FieldConfig.decimal(config, MAX);
        if (min.isPresent() && max.isPresent() && min.get().compareTo(max.get()) > 0) {
            return "O valor mínimo não pode ser maior que o máximo.";
        }
        return null;
    }

    private static String checkSelectionLimits(Map<String, Object> config, int optionCount) {
        Optional<Integer> min = FieldConfig.integer(config, MIN_SELECTED);
        Optional<Integer> max = FieldConfig.integer(config, MAX_SELECTED);
        if (min.isPresent() && (min.get() < 0 || min.get() > optionCount)) {
            return "O mínimo de seleções deve estar entre 0 e o número de opções.";
        }
        if (max.isPresent() && (max.get() < 1 || max.get() > optionCount)) {
            return "O máximo de seleções deve estar entre 1 e o número de opções.";
        }
        if (min.isPresent() && max.isPresent() && min.get() > max.get()) {
            return "O mínimo de seleções não pode ser maior que o máximo.";
        }
        return null;
    }

    private static String checkScale(Map<String, Object> config) {
        int min = FieldConfig.scaleMin(config);
        int max = FieldConfig.scaleMax(config);
        if (min < 0 || min > 1) {
            return "A escala deve começar em 0 ou 1.";
        }
        if (max < 2 || max > 10) {
            return "A escala deve terminar entre 2 e 10.";
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
