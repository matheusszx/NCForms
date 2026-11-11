import { defaultConfig, fieldTypeInfo } from '../../core/field-types';
import { FieldOption, FieldType, FormField } from '../../core/models';

/** Field in the editor: `key` is a stable local identifier (new fields don't have an id yet). */
export interface EditorField extends FormField {
  key: string;
}

export const DEFAULT_QUESTION_LABEL = 'Untitled question';
export const DEFAULT_SECTION_LABEL = 'New section';

let keyCounter = 0;

export function newKey(): string {
  keyCounter += 1;
  return `k${Date.now().toString(36)}${keyCounter.toString(36)}`;
}

export function toEditorFields(fields: FormField[]): EditorField[] {
  return fields.map((f) => ({ ...f, config: { ...f.config }, options: f.options.map((o) => ({ ...o })), key: newKey() }));
}

/** Removes the local key before sending to the API. */
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
    options: fieldTypeInfo(type).hasOptions ? [{ id: null, label: 'Option 1' }] : [],
  };
}

/** Inserts after `afterIndex` (or at the end when -1/out of range). Returns the new list and the inserted index. */
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

/** Duplicates the field as a new one (no ids), right below the original. */
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
 * Changes the type keeping what makes sense: label and help text always; options between choice types;
 * settings reset to the new type's defaults.
 */
export function changeFieldType(field: EditorField, type: FieldType): EditorField {
  const info = fieldTypeInfo(type);
  let options: FieldOption[] = [];
  if (info.hasOptions) {
    options = field.options.length > 0 ? field.options : [{ id: null, label: 'Option 1' }];
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
 * Groups API errors by field index. Accepts keys from the validator ("fields.2.label")
 * and from Bean Validation ("fields[2].type").
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
