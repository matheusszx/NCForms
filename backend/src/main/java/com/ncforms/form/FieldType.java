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

    /** Fields that receive an answer from the user (SECTION_TITLE is visual only). */
    public boolean isInput() {
        return this != SECTION_TITLE;
    }

    /** Fields whose answers reference defined options. */
    public boolean hasOptions() {
        return this == RADIO || this == CHECKBOX || this == DROPDOWN;
    }
}
