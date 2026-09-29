package com.ncforms.form;

public enum FieldType {
    SECTION_TITLE,
    SHORT_TEXT,
    LONG_TEXT,
    EMAIL,
    NUMBER,
    DATE,
    RADIO,
    CHECKBOX,
    DROPDOWN,
    LINEAR_SCALE;

    /** Campos que recebem resposta do usuário (SECTION_TITLE é apenas visual). */
    public boolean isInput() {
        return this != SECTION_TITLE;
    }

    /** Campos cujas respostas referenciam opções cadastradas. */
    public boolean hasOptions() {
        return this == RADIO || this == CHECKBOX || this == DROPDOWN;
    }
}
