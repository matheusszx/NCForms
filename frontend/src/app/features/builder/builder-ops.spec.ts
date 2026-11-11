import {
  DEFAULT_QUESTION_LABEL,
  DEFAULT_SECTION_LABEL,
  EditorField,
  changeFieldType,
  createField,
  duplicateField,
  errorsByFieldIndex,
  insertField,
  moveField,
  patchField,
  removeField,
  toEditorFields,
  toRequestFields,
} from './builder-ops';

function labels(fields: EditorField[]): string[] {
  return fields.map((f) => f.label);
}

function named(label: string, type: EditorField['type'] = 'SHORT_TEXT'): EditorField {
  return { ...createField(type), label };
}

describe('builder-ops', () => {
  it('createField sets defaults per type', () => {
    const radio = createField('RADIO');
    expect(radio.id).toBeNull();
    expect(radio.label).toBe(DEFAULT_QUESTION_LABEL);
    expect(radio.options).toEqual([{ id: null, label: 'Option 1' }]);

    expect(createField('SECTION_TITLE').label).toBe(DEFAULT_SECTION_LABEL);
    expect(createField('LINEAR_SCALE').config).toEqual({ min: 1, max: 5 });
    expect(createField('SHORT_TEXT').options).toEqual([]);
  });

  it('generates unique local keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => createField('DATE').key));
    expect(keys.size).toBe(50);
  });

  it('insertField inserts after the active field or at the end', () => {
    const fields = [named('A'), named('B')];
    const afterFirst = insertField(fields, named('X'), 0);
    expect(labels(afterFirst.fields)).toEqual(['A', 'X', 'B']);
    expect(afterFirst.index).toBe(1);

    const atEnd = insertField(fields, named('Y'), -1);
    expect(labels(atEnd.fields)).toEqual(['A', 'B', 'Y']);
    expect(atEnd.index).toBe(2);
  });

  it('duplicateField copies without ids, right below', () => {
    const original: EditorField = {
      ...named('Color', 'RADIO'),
      id: 'f1',
      options: [
        { id: 'o1', label: 'Blue' },
        { id: 'o2', label: 'Green' },
      ],
    };
    const { fields, index } = duplicateField([original, named('End')], 0);
    expect(index).toBe(1);
    expect(labels(fields)).toEqual(['Color', 'Color', 'End']);
    expect(fields[1].id).toBeNull();
    expect(fields[1].key).not.toBe(original.key);
    expect(fields[1].options).toEqual([
      { id: null, label: 'Blue' },
      { id: null, label: 'Green' },
    ]);
    expect(fields[0].options[0].id).toBe('o1');
  });

  it('removeField and moveField', () => {
    const fields = [named('A'), named('B'), named('C')];
    expect(labels(removeField(fields, 1))).toEqual(['A', 'C']);
    expect(labels(moveField(fields, 0, 2))).toEqual(['B', 'C', 'A']);
    expect(labels(moveField(fields, 2, 0))).toEqual(['C', 'A', 'B']);
    expect(moveField(fields, 0, -1)).toBe(fields);
    expect(labels(fields)).toEqual(['A', 'B', 'C']);
  });

  it('patchField only changes the given field', () => {
    const fields = [named('A'), named('B')];
    const patched = patchField(fields, 1, { required: true });
    expect(patched[1].required).toBe(true);
    expect(patched[0]).toBe(fields[0]);
  });

  it('changeFieldType keeps options between choice types and clears them when leaving', () => {
    const radio: EditorField = { ...named('Color', 'RADIO'), required: true, options: [{ id: 'o1', label: 'Blue' }] };

    const checkbox = changeFieldType(radio, 'CHECKBOX');
    expect(checkbox.options).toEqual([{ id: 'o1', label: 'Blue' }]);
    expect(checkbox.required).toBe(true);

    const text = changeFieldType(radio, 'SHORT_TEXT');
    expect(text.options).toEqual([]);
    expect(text.label).toBe('Color');

    const section = changeFieldType(createField('SHORT_TEXT'), 'SECTION_TITLE');
    expect(section.label).toBe(DEFAULT_SECTION_LABEL);
    expect(section.required).toBe(false);

    const scale = changeFieldType(radio, 'LINEAR_SCALE');
    expect(scale.config).toEqual({ min: 1, max: 5 });
  });

  it('toRequestFields removes the local key', () => {
    const [field] = toEditorFields([
      { id: 'f1', type: 'EMAIL', label: 'Email', helpText: null, required: true, config: {}, options: [] },
    ]);
    expect(field.key).toBeTruthy();
    expect(toRequestFields([field])[0]).toEqual({
      id: 'f1',
      type: 'EMAIL',
      label: 'Email',
      helpText: null,
      required: true,
      config: {},
      options: [],
    });
  });

  it('errorsByFieldIndex groups API errors by index', () => {
    const map = errorsByFieldIndex({
      'fields.0.label': 'Enter the text.',
      'fields.0.options': 'Add options.',
      'fields[3].type': 'Enter the type.',
      title: 'Enter the title.',
    });
    expect(map.get(0)).toEqual({ label: 'Enter the text.', options: 'Add options.' });
    expect(map.get(3)).toEqual({ type: 'Enter the type.' });
    expect(map.size).toBe(2);
  });
});
