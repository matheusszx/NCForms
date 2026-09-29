import { defaultConfig, fieldTypeInfo } from '../../core/field-types';
import { FieldOption, FieldType, FormField } from '../../core/models';

/** Campo no editor: `key` é um identificador local estável (campos novos ainda não têm id). */
export interface EditorField extends FormField {
  key: string;
}

export const DEFAULT_QUESTION_LABEL = 'Pergunta sem título';
export const DEFAULT_SECTION_LABEL = 'Nova seção';

let keyCounter = 0;

export function newKey(): string {
  keyCounter += 1;
  return `k${Date.now().toString(36)}${keyCounter.toString(36)}`;
}

export function toEditorFields(fields: FormField[]): EditorField[] {
  return fields.map((f) => ({ ...f, config: { ...f.config }, options: f.options.map((o) => ({ ...o })), key: newKey() }));
}

/** Remove a chave local antes de enviar para a API. */
export function toRequestFields(fields: EditorField[]): FormField[] {
  return fields.map(({ key: _key, ...field }) => field);
}

export function createField(type: FieldType): EditorField {
  return {
    key: newKey(),
    id: null,
    type,
    label: type === 'SECTION_TITLE' ? DEFAULT_SECTION_LABEL : DEFAULT_QUESTION_LABEL,
    helpText: null,
    required: false,
    config: defaultConfig(type),
    options: fieldTypeInfo(type).hasOptions ? [{ id: null, label: 'Opção 1' }] : [],
  };
}

/** Insere após `afterIndex` (ou no fim quando -1/fora do intervalo). Retorna a nova lista e o índice inserido. */
export function insertField(
  fields: EditorField[],
  field: EditorField,
  afterIndex: number,
): { fields: EditorField[]; index: number } {
  const index = afterIndex >= 0 && afterIndex < fields.length ? afterIndex + 1 : fields.length;
  const next = [...fields];
  next.splice(index, 0, field);
  return { fields: next, index };
}

/** Duplica o campo como um novo (sem ids), logo abaixo do original. */
export function duplicateField(fields: EditorField[], index: number): { fields: EditorField[]; index: number } {
  const source = fields[index];
  const copy: EditorField = {
    ...source,
    key: newKey(),
    id: null,
    config: { ...source.config },
    options: source.options.map((o) => ({ id: null, label: o.label })),
  };
  return insertField(fields, copy, index);
}

export function removeField(fields: EditorField[], index: number): EditorField[] {
  return fields.filter((_, i) => i !== index);
}

export function moveField(fields: EditorField[], from: number, to: number): EditorField[] {
  const target = Math.max(0, Math.min(fields.length - 1, to));
  if (from === target || from < 0 || from >= fields.length) {
    return fields;
  }
  const next = [...fields];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

export function patchField(fields: EditorField[], index: number, patch: Partial<EditorField>): EditorField[] {
  return fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
}

/**
 * Troca o tipo mantendo o que faz sentido: texto e ajuda sempre; opções entre tipos de escolha;
 * configurações voltam ao padrão do novo tipo.
 */
export function changeFieldType(field: EditorField, type: FieldType): EditorField {
  const info = fieldTypeInfo(type);
  let options: FieldOption[] = [];
  if (info.hasOptions) {
    options = field.options.length > 0 ? field.options : [{ id: null, label: 'Opção 1' }];
  }
  let label = field.label;
  if (type === 'SECTION_TITLE' && label === DEFAULT_QUESTION_LABEL) {
    label = DEFAULT_SECTION_LABEL;
  } else if (field.type === 'SECTION_TITLE' && label === DEFAULT_SECTION_LABEL) {
    label = DEFAULT_QUESTION_LABEL;
  }
  return { ...field, type, label, required: info.isInput && field.required, config: defaultConfig(type), options };
}

/**
 * Agrupa erros da API por índice de campo. Aceita chaves do validador ("fields.2.label")
 * e da Bean Validation ("fields[2].type").
 */
export function errorsByFieldIndex(fieldErrors: Record<string, string>): Map<number, Record<string, string>> {
  const result = new Map<number, Record<string, string>>();
  for (const [key, message] of Object.entries(fieldErrors)) {
    const match = /^fields(?:\.(\d+)|\[(\d+)\])\.(\w+)/.exec(key);
    if (!match) {
      continue;
    }
    const index = Number(match[1] ?? match[2]);
    const errors = result.get(index) ?? {};
    errors[match[3]] = message;
    result.set(index, errors);
  }
  return result;
}
