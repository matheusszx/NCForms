package com.ncforms.form;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.ncforms.common.ValidationException;
import com.ncforms.form.FormDtos.FieldDto;
import com.ncforms.form.FormDtos.OptionDto;

class FormDefinitionValidatorTest {

    private final FormDefinitionValidator validator = new FormDefinitionValidator();

    @Test
    void normalizesTextsAndDropsUnsupportedConfigKeys() {
        FieldDto input = new FieldDto(null, FieldType.SHORT_TEXT, "  Nome  ", "  ", true,
                Map.of("placeholder", " Seu nome ", "min", 3, "foo", "bar"), List.of(new OptionDto(null, "x")));

        FieldDto result = validator.validate(List.of(input)).get(0);

        assertThat(result.label()).isEqualTo("Nome");
        assertThat(result.helpText()).isNull();
        assertThat(result.config()).containsOnlyKeys("placeholder").containsEntry("placeholder", "Seu nome");
        assertThat(result.options()).isEmpty();
        assertThat(result.required()).isTrue();
    }

    @Test
    void sectionTitleIsNeverRequired() {
        FieldDto input = new FieldDto(null, FieldType.SECTION_TITLE, "Parte 2", null, true, null, null);

        assertThat(validator.validate(List.of(input)).get(0).required()).isFalse();
    }

    @Test
    void missingRequiredFlagMeansOptional() {
        FieldDto input = new FieldDto(null, FieldType.DATE, "Data", null, null, null, null);

        assertThat(validator.validate(List.of(input)).get(0).required()).isFalse();
    }

    @Test
    void choiceFieldsNeedNonBlankOptions() {
        FieldDto noOptions = new FieldDto(null, FieldType.RADIO, "Cor?", null, false, null, List.of());
        FieldDto blankOption = new FieldDto(null, FieldType.CHECKBOX, "Frutas?", null, false, null,
                List.of(new OptionDto(null, "Maçã"), new OptionDto(null, " ")));

        ValidationException ex = catchThrowableOfType(ValidationException.class,
                () -> validator.validate(List.of(noOptions, blankOption)));

        assertThat(ex.getFieldErrors()).containsOnlyKeys("fields.0.options", "fields.1.options");
    }

    @Test
    void missingLabelIsReportedWithFieldIndex() {
        FieldDto ok = new FieldDto(null, FieldType.EMAIL, "E-mail", null, false, null, null);
        FieldDto missing = new FieldDto(null, FieldType.DATE, "", null, false, null, null);

        ValidationException ex = catchThrowableOfType(ValidationException.class,
                () -> validator.validate(List.of(ok, missing)));

        assertThat(ex.getFieldErrors()).containsOnlyKeys("fields.1.label");
    }

    @Test
    void rejectsInconsistentRanges() {
        FieldDto number = new FieldDto(null, FieldType.NUMBER, "Idade", null, false, Map.of("min", 10, "max", 1), null);
        FieldDto scale = new FieldDto(null, FieldType.LINEAR_SCALE, "Nota", null, false, Map.of("max", 20), null);
        FieldDto checkbox = new FieldDto(null, FieldType.CHECKBOX, "Itens", null, false, Map.of("maxSelected", 5),
                List.of(new OptionDto(null, "A"), new OptionDto(null, "B")));
        FieldDto text = new FieldDto(null, FieldType.SHORT_TEXT, "Obs", null, false, Map.of("maxLength", "muito"), null);

        ValidationException ex = catchThrowableOfType(ValidationException.class,
                () -> validator.validate(List.of(number, scale, checkbox, text)));

        assertThat(ex.getFieldErrors()).containsOnlyKeys(
                "fields.0.config", "fields.1.config", "fields.2.config", "fields.3.config");
    }
}
