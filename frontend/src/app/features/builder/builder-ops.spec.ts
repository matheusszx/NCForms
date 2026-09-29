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
  it('createField define padrões por tipo', () => {
    const radio = createField('RADIO');
    expect(radio.id).toBeNull();
    expect(radio.label).toBe(DEFAULT_QUESTION_LABEL);
    expect(radio.options).toEqual([{ id: null, label: 'Opção 1' }]);

    expect(createField('SECTION_TITLE').label).toBe(DEFAULT_SECTION_LABEL);
    expect(createField('LINEAR_SCALE').config).toEqual({ min: 1, max: 5 });
    expect(createField('SHORT_TEXT').options).toEqual([]);
  });

  it('gera chaves locais únicas', () => {
    const keys = new Set(Array.from({ length: 50 }, () => createField('DATE').key));
    expect(keys.size).toBe(50);
  });

  it('insertField insere após o campo ativo ou no fim', () => {
    const fields = [named('A'), named('B')];
    const afterFirst = insertField(fields, named('X'), 0);
    expect(labels(afterFirst.fields)).toEqual(['A', 'X', 'B']);
    expect(afterFirst.index).toBe(1);

    const atEnd = insertField(fields, named('Y'), -1);
    expect(labels(atEnd.fields)).toEqual(['A', 'B', 'Y']);
    expect(atEnd.index).toBe(2);
  });

  it('duplicateField copia sem ids e logo abaixo', () => {
    const original: EditorField = {
      ...named('Cor', 'RADIO'),
      id: 'f1',
      options: [
        { id: 'o1', label: 'Azul' },
        { id: 'o2', label: 'Verde' },
      ],
    };
    const { fields, index } = duplicateField([original, named('Fim')], 0);
    expect(index).toBe(1);
    expect(labels(fields)).toEqual(['Cor', 'Cor', 'Fim']);
    expect(fields[1].id).toBeNull();
    expect(fields[1].key).not.toBe(original.key);
    expect(fields[1].options).toEqual([
      { id: null, label: 'Azul' },
      { id: null, label: 'Verde' },
    ]);
    expect(fields[0].options[0].id).toBe('o1');
  });

  it('removeField e moveField', () => {
    const fields = [named('A'), named('B'), named('C')];
    expect(labels(removeField(fields, 1))).toEqual(['A', 'C']);
    expect(labels(moveField(fields, 0, 2))).toEqual(['B', 'C', 'A']);
    expect(labels(moveField(fields, 2, 0))).toEqual(['C', 'A', 'B']);
    expect(moveField(fields, 0, -1)).toBe(fields);
    expect(labels(fields)).toEqual(['A', 'B', 'C']);
  });

  it('patchField altera apenas o campo indicado', () => {
    const fields = [named('A'), named('B')];
    const patched = patchField(fields, 1, { required: true });
    expect(patched[1].required).toBe(true);
    expect(patched[0]).toBe(fields[0]);
  });

  it('changeFieldType preserva opções entre tipos de escolha e limpa ao sair', () => {
    const radio: EditorField = { ...named('Cor', 'RADIO'), required: true, options: [{ id: 'o1', label: 'Azul' }] };

    const checkbox = changeFieldType(radio, 'CHECKBOX');
    expect(checkbox.options).toEqual([{ id: 'o1', label: 'Azul' }]);
    expect(checkbox.required).toBe(true);

    const text = changeFieldType(radio, 'SHORT_TEXT');
    expect(text.options).toEqual([]);
    expect(text.label).toBe('Cor');

    const section = changeFieldType(createField('SHORT_TEXT'), 'SECTION_TITLE');
    expect(section.label).toBe(DEFAULT_SECTION_LABEL);
    expect(section.required).toBe(false);

    const scale = changeFieldType(radio, 'LINEAR_SCALE');
    expect(scale.config).toEqual({ min: 1, max: 5 });
  });

  it('toRequestFields remove a chave local', () => {
    const [field] = toEditorFields([
      { id: 'f1', type: 'EMAIL', label: 'E-mail', helpText: null, required: true, config: {}, options: [] },
    ]);
    expect(field.key).toBeTruthy();
    expect(toRequestFields([field])[0]).toEqual({
      id: 'f1',
      type: 'EMAIL',
      label: 'E-mail',
      helpText: null,
      required: true,
      config: {},
      options: [],
    });
  });

  it('errorsByFieldIndex agrupa erros da API por índice', () => {
    const map = errorsByFieldIndex({
      'fields.0.label': 'Informe o texto.',
      'fields.0.options': 'Adicione opções.',
      'fields[3].type': 'Informe o tipo.',
      title: 'Informe o título.',
    });
    expect(map.get(0)).toEqual({ label: 'Informe o texto.', options: 'Adicione opções.' });
    expect(map.get(3)).toEqual({ type: 'Informe o tipo.' });
    expect(map.size).toBe(2);
  });
});
