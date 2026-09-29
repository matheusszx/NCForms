package com.ncforms.form;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/** Chaves e leitura tipada do JSON de configuração de um campo. */
public final class FieldConfig {

    public static final String PLACEHOLDER = "placeholder";
    public static final String MAX_LENGTH = "maxLength";
    public static final String MIN = "min";
    public static final String MAX = "max";
    public static final String MIN_SELECTED = "minSelected";
    public static final String MAX_SELECTED = "maxSelected";
    public static final String MIN_LABEL = "minLabel";
    public static final String MAX_LABEL = "maxLabel";

    public static final int DEFAULT_SHORT_TEXT_MAX_LENGTH = 500;
    public static final int DEFAULT_LONG_TEXT_MAX_LENGTH = 10_000;
    public static final int DEFAULT_SCALE_MIN = 1;
    public static final int DEFAULT_SCALE_MAX = 5;

    private FieldConfig() {
    }

    public static Optional<Integer> integer(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value instanceof Number n ? Optional.of(n.intValue()) : Optional.empty();
    }

    public static Optional<BigDecimal> decimal(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value instanceof Number n ? Optional.of(new BigDecimal(n.toString())) : Optional.empty();
    }

    public static int scaleMin(Map<String, Object> config) {
        return integer(config, MIN).orElse(DEFAULT_SCALE_MIN);
    }

    public static int scaleMax(Map<String, Object> config) {
        return integer(config, MAX).orElse(DEFAULT_SCALE_MAX);
    }

    public static int textMaxLength(FieldType type, Map<String, Object> config) {
        int fallback = type == FieldType.LONG_TEXT ? DEFAULT_LONG_TEXT_MAX_LENGTH : DEFAULT_SHORT_TEXT_MAX_LENGTH;
        return integer(config, MAX_LENGTH).orElse(fallback);
    }
}
