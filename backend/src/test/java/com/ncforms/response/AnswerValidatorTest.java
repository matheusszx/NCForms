package com.ncforms.response;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.ncforms.common.ValidationException;
import com.ncforms.form.FieldOption;
import com.ncforms.form.FieldType;
import com.ncforms.form.FormField;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

class AnswerValidatorTest {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    private final AnswerValidator validator = new AnswerValidator();

    @Test
    void requiredFieldWithoutAnswerIsRejected() {
        FormField name = field(FieldType.SHORT_TEXT, true);

        Map<String, String> errors = errorsOf(List.of(name), Map.of());

        assertThat(errors).containsEntry(key(name), AnswerValidator.REQUIRED);
    }

    @Test
    void blankTextAndEmptyArrayCountAsMissing() {
        FormField text = field(FieldType.SHORT_TEXT, true);
        FormField checkbox = field(FieldType.CHECKBOX, true, "A", "B");

        Map<String, String> errors = errorsOf(List.of(text, checkbox),
                Map.of(key(text), JSON.stringNode("   "), key(checkbox), JSON.arrayNode()));

        assertThat(errors).containsOnlyKeys(key(text), key(checkbox));
    }

    @Test
    void optionalFieldsMayBeOmitted() {
        FormField text = field(FieldType.LONG_TEXT, false);

        assertThat(validator.validate(List.of(text), Map.of())).isEmpty();
    }

    @Test
    void textIsTrimmedAndMaxLengthEnforced() {
        FormField text = field(FieldType.SHORT_TEXT, false);
        text.setConfig(Map.of("maxLength", 5));

        Map<UUID, JsonNode> ok = validator.validate(List.of(text), Map.of(key(text), JSON.stringNode("  abc  ")));
        assertThat(ok.get(text.getId()).asString()).isEqualTo("abc");

        assertThat(errorsOf(List.of(text), Map.of(key(text), JSON.stringNode("abcdef"))))
                .containsKey(key(text));
    }

    @Test
    void invalidEmailIsRejected() {
        FormField email = field(FieldType.EMAIL, true);

        assertThat(errorsOf(List.of(email), Map.of(key(email), JSON.stringNode("nao-e-email"))))
                .containsEntry(key(email), "Informe um e-mail válido.");
        assertThat(validator.validate(List.of(email), Map.of(key(email), JSON.stringNode("a@b.com"))))
                .containsKey(email.getId());
    }

    @Test
    void numberOutsideRangeIsRejected() {
        FormField age = field(FieldType.NUMBER, true);
        age.setConfig(Map.of("min", 18, "max", 99));

        assertThat(errorsOf(List.of(age), Map.of(key(age), JSON.numberNode(10))))
                .containsEntry(key(age), "O valor deve ser no mínimo 18.");
        assertThat(errorsOf(List.of(age), Map.of(key(age), JSON.stringNode("abc"))))
                .containsEntry(key(age), "Informe um número válido.");

        JsonNode stored = validator.validate(List.of(age), Map.of(key(age), JSON.stringNode("30,50"))).get(age.getId());
        assertThat(stored.decimalValue()).isEqualByComparingTo("30.5");
    }

    @Test
    void invalidDateIsRejected() {
        FormField date = field(FieldType.DATE, false);

        assertThat(errorsOf(List.of(date), Map.of(key(date), JSON.stringNode("31/02/2024"))))
                .containsEntry(key(date), "Informe uma data válida.");
        assertThat(validator.validate(List.of(date), Map.of(key(date), JSON.stringNode("2024-02-29"))))
                .containsKey(date.getId());
    }

    @Test
    void radioMustReferenceAnOptionOfTheField() {
        FormField radio = field(FieldType.RADIO, true, "Sim", "Não");

        assertThat(errorsOf(List.of(radio), Map.of(key(radio), JSON.stringNode(UUID.randomUUID().toString()))))
                .containsEntry(key(radio), AnswerValidator.INVALID_OPTION);

        String yes = optionId(radio, 0);
        assertThat(validator.validate(List.of(radio), Map.of(key(radio), JSON.stringNode(yes)))
                .get(radio.getId()).asString()).isEqualTo(yes);
    }

    @Test
    void archivedOptionsAreNotAccepted() {
        FormField dropdown = field(FieldType.DROPDOWN, false, "A", "B");
        dropdown.getOptions().get(1).setArchived(true);

        assertThat(errorsOf(List.of(dropdown), Map.of(key(dropdown), JSON.stringNode(optionId(dropdown, 1)))))
                .containsEntry(key(dropdown), AnswerValidator.INVALID_OPTION);
    }

    @Test
    void checkboxEnforcesSelectionLimitsAndDeduplicates() {
        FormField checkbox = field(FieldType.CHECKBOX, false, "A", "B", "C");
        checkbox.setConfig(Map.of("minSelected", 2, "maxSelected", 2));
        String a = optionId(checkbox, 0);
        String b = optionId(checkbox, 1);
        String c = optionId(checkbox, 2);

        assertThat(errorsOf(List.of(checkbox), Map.of(key(checkbox), JSON.arrayNode().add(a))))
                .containsEntry(key(checkbox), "Selecione pelo menos 2 opções.");
        assertThat(errorsOf(List.of(checkbox), Map.of(key(checkbox), JSON.arrayNode().add(a).add(b).add(c))))
                .containsEntry(key(checkbox), "Selecione no máximo 2 opções.");
        assertThat(errorsOf(List.of(checkbox), Map.of(key(checkbox), JSON.stringNode(a))))
                .containsEntry(key(checkbox), AnswerValidator.INVALID);

        JsonNode stored = validator.validate(List.of(checkbox),
                Map.of(key(checkbox), JSON.arrayNode().add(a).add(b).add(a))).get(checkbox.getId());
        assertThat(stored.size()).isEqualTo(2);
    }

    @Test
    void linearScaleMustBeAnIntegerWithinBounds() {
        FormField scale = field(FieldType.LINEAR_SCALE, true);
        scale.setConfig(Map.of("min", 1, "max", 5));

        assertThat(errorsOf(List.of(scale), Map.of(key(scale), JSON.numberNode(6)))).containsKey(key(scale));
        assertThat(errorsOf(List.of(scale), Map.of(key(scale), JSON.numberNode(2.5)))).containsKey(key(scale));
        assertThat(validator.validate(List.of(scale), Map.of(key(scale), JSON.numberNode(5)))
                .get(scale.getId()).intValue()).isEqualTo(5);
    }

    @Test
    void sectionTitlesAndArchivedFieldsAreIgnored() {
        FormField section = field(FieldType.SECTION_TITLE, false);
        FormField archived = field(FieldType.SHORT_TEXT, true);
        archived.setArchived(true);

        assertThat(validator.validate(List.of(section, archived), Map.of())).isEmpty();
    }

    @Test
    void reportsAllErrorsAtOnce() {
        FormField a = field(FieldType.SHORT_TEXT, true);
        FormField b = field(FieldType.EMAIL, true);

        assertThat(errorsOf(List.of(a, b), Map.of(key(b), JSON.stringNode("x")))).hasSize(2);
    }

    private Map<String, String> errorsOf(List<FormField> fields, Map<String, JsonNode> answers) {
        ValidationException ex = catchThrowableOfType(ValidationException.class,
                () -> validator.validate(fields, answers));
        assertThat(ex).as("esperava ValidationException").isNotNull();
        return ex.getFieldErrors();
    }

    private static FormField field(FieldType type, boolean required, String... options) {
        FormField field = new FormField(type);
        ReflectionTestUtils.setField(field, "id", UUID.randomUUID());
        field.setLabel(type.name());
        field.setRequired(required);
        for (String label : options) {
            FieldOption option = new FieldOption(label);
            ReflectionTestUtils.setField(option, "id", UUID.randomUUID());
            field.addOption(option);
        }
        return field;
    }

    private static String key(FormField field) {
        return field.getId().toString();
    }

    private static String optionId(FormField field, int index) {
        return field.getOptions().get(index).getId().toString();
    }
}
