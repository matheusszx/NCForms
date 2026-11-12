import { AnswerValue, FieldConfig, FieldType, FormField } from '../models';
import { MockField } from './mock-db';

/** TypeScript port of backend FormDefinitionValidator / AnswerValidator (same rules and messages). */
export class MockValidationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
  }
}

const MAX_LABEL_LENGTH = 500;
const MAX_OPTIONS = 100;
const MAX_CONFIG_TEXT_LENGTH = 200;
const DEFAULT_SHORT_TEXT_MAX_LENGTH = 500;
const DEFAULT_LONG_TEXT_MAX_LENGTH = 10_000;
const DEFAULT_SCALE_MIN = 1;
const DEFAULT_SCALE_MAX = 5;
const TEXT_KEYS = new Set(['placeholder', 'minLabel', 'maxLabel']);

const ALLOWED_CONFIG: Record<FieldType, (keyof FieldConfig)[]> = {
  SECTION_TITLE: [],
  SHORT_TEXT: ['placeholder', 'maxLength'],
  LONG_TEXT: ['placeholder', 'maxLength'],
  EMAIL: ['placeholder'],
  NUMBER: ['placeholder', 'min', 'max'],
  DATE: [],
  RADIO: [],
  CHECKBOX: ['minSelected', 'maxSelected'],
  DROPDOWN: [],
  LINEAR_SCALE: ['min', 'max', 'minLabel', 'maxLabel'],
};

export const isInput = (type: FieldType) => type !== 'SECTION_TITLE';
export const hasOptions = (type: FieldType) => type === 'RADIO' || type === 'CHECKBOX' || type === 'DROPDOWN';

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

const int = (config: FieldConfig, key: keyof FieldConfig): number | undefined => {
  const v = config[key];
  return typeof v === 'number' ? Math.trunc(v) : undefined;
};
const num = (config: FieldConfig, key: keyof FieldConfig): number | undefined => {
  const v = config[key];
  return typeof v === 'number' ? v : undefined;
};
const scaleMin = (c: FieldConfig) => int(c, 'min') ?? DEFAULT_SCALE_MIN;
const scaleMax = (c: FieldConfig) => int(c, 'max') ?? DEFAULT_SCALE_MAX;
const textMaxLength = (type: FieldType, c: FieldConfig) =>
  int(c, 'maxLength') ?? (type === 'LONG_TEXT' ? DEFAULT_LONG_TEXT_MAX_LENGTH : DEFAULT_SHORT_TEXT_MAX_LENGTH);

/** Validates and normalizes the editor payload. Error keys: {@code fields.<index>.<attribute>}. */
export function validateDefinition(fields: FormField[]): FormField[] {
  const errors: Record<string, string> = {};
  const normalized = fields.map((field, i) => validateField(field, `fields.${i}.`, errors));
  if (Object.keys(errors).length > 0) {
    throw new MockValidationError('Please review the highlighted form fields.', errors);
  }
  return normalized;
}

function validateField(field: FormField, prefix: string, errors: Record<string, string>): FormField {
  const type = field.type;
  const label = trimToNull(field.label);
  if (label == null) {
    errors[prefix + 'label'] = type === 'SECTION_TITLE' ? 'Enter the section title.' : 'Enter the question text.';
  } else if (label.length > MAX_LABEL_LENGTH) {
    errors[prefix + 'label'] = `Text is too long (max. ${MAX_LABEL_LENGTH} characters).`;
  }

  let options: FormField['options'] = [];
  if (hasOptions(type)) {
    const raw = field.options ?? [];
    if (raw.length === 0) {
      errors[prefix + 'options'] = 'Add at least one option.';
    } else {
      if (raw.length > MAX_OPTIONS) {
        errors[prefix + 'options'] = `Limit of ${MAX_OPTIONS} options per question.`;
      }
      options = raw.map((o) => {
        const optLabel = trimToNull(o.label);
        if (optLabel == null) {
          errors[prefix + 'options'] ??= 'All options need a label.';
        } else if (optLabel.length > MAX_LABEL_LENGTH) {
          errors[prefix + 'options'] ??= 'Option label is too long.';
        }
        return { id: o.id, label: optLabel ?? '' };
      });
    }
  }

  const config: FieldConfig = {};
  const raw = (field.config ?? {}) as Record<string, unknown>;
  for (const key of ALLOWED_CONFIG[type]) {
    const value = raw[key];
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      continue;
    }
    if (TEXT_KEYS.has(key)) {
      const text = String(value).trim();
      if (text.length > MAX_CONFIG_TEXT_LENGTH) {
        errors[prefix + 'config'] = 'Setting text is too long.';
      }
      (config as Record<string, unknown>)[key] = text;
    } else if (typeof value === 'number') {
      (config as Record<string, unknown>)[key] = value;
    } else {
      errors[prefix + 'config'] = `Invalid setting: "${key}" must be numeric.`;
    }
  }

  const configError = checkConfig(type, config, options.length);
  if (configError) {
    errors[prefix + 'config'] = configError;
  }

  return {
    id: field.id,
    type,
    label: label ?? '',
    helpText: trimToNull(field.helpText),
    required: isInput(type) && field.required === true,
    config,
    options,
  };
}

function checkConfig(type: FieldType, config: FieldConfig, optionCount: number): string | null {
  switch (type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT': {
      const max = int(config, 'maxLength');
      const limit = type === 'LONG_TEXT' ? DEFAULT_LONG_TEXT_MAX_LENGTH : DEFAULT_SHORT_TEXT_MAX_LENGTH;
      return max !== undefined && (max < 1 || max > limit) ? `The character limit must be between 1 and ${limit}.` : null;
    }
    case 'NUMBER': {
      const min = num(config, 'min');
      const max = num(config, 'max');
      return min !== undefined && max !== undefined && min > max
        ? 'The minimum value cannot be greater than the maximum.'
        : null;
    }
    case 'CHECKBOX': {
      const min = int(config, 'minSelected');
      const max = int(config, 'maxSelected');
      if (min !== undefined && (min < 0 || min > optionCount)) {
        return 'The minimum selections must be between 0 and the number of options.';
      }
      if (max !== undefined && (max < 1 || max > optionCount)) {
        return 'The maximum selections must be between 1 and the number of options.';
      }
      if (min !== undefined && max !== undefined && min > max) {
        return 'The minimum selections cannot be greater than the maximum.';
      }
      return null;
    }
    case 'LINEAR_SCALE': {
      const min = scaleMin(config);
      const max = scaleMax(config);
      if (min < 0 || min > 1) {
        return 'The scale must start at 0 or 1.';
      }
      if (max < 2 || max > 10) {
        return 'The scale must end between 2 and 10.';
      }
      return null;
    }
    default:
      return null;
  }
}

const REQUIRED = 'This question is required.';
const INVALID = 'Invalid answer.';
const INVALID_OPTION = 'Invalid option.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class InvalidAnswer extends Error {}

/** Validates submitted answers against the active fields and returns normalized values by field id. */
export function validateAnswers(fields: MockField[], answers: Record<string, unknown> | null | undefined) {
  const input = answers ?? {};
  const errors: Record<string, string> = {};
  const result: Record<string, AnswerValue> = {};

  for (const field of fields) {
    if (field.archived || !isInput(field.type)) {
      continue;
    }
    const value = input[field.id];
    if (isEmpty(value)) {
      if (field.required) {
        errors[field.id] = REQUIRED;
      }
      continue;
    }
    try {
      result[field.id] = normalize(field, value);
    } catch (e) {
      errors[field.id] = e instanceof InvalidAnswer ? e.message : INVALID;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new MockValidationError('Some answers need attention.', errors);
  }
  return result;
}

function normalize(field: MockField, value: unknown): AnswerValue {
  const config = field.config ?? {};
  const activeIds = () => new Set(field.options.filter((o) => !o.archived).map((o) => o.id));
  switch (field.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT': {
      const text = requireText(value).trim();
      const max = textMaxLength(field.type, config);
      if (text.length > max) {
        throw new InvalidAnswer(`The answer must be at most ${max} characters.`);
      }
      return text;
    }
    case 'EMAIL': {
      const email = requireText(value).trim();
      if (email.length > 255 || !EMAIL.test(email)) {
        throw new InvalidAnswer('Enter a valid email address.');
      }
      return email;
    }
    case 'NUMBER': {
      const n = toNumber(value);
      if (n === null) {
        throw new InvalidAnswer('Enter a valid number.');
      }
      const min = num(config, 'min');
      const max = num(config, 'max');
      if (min !== undefined && n < min) {
        throw new InvalidAnswer(`The value must be at least ${min}.`);
      }
      if (max !== undefined && n > max) {
        throw new InvalidAnswer(`The value must be at most ${max}.`);
      }
      return n;
    }
    case 'DATE': {
      const text = requireText(value).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
        throw new InvalidAnswer('Enter a valid date.');
      }
      const [y, m, d] = text.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
        throw new InvalidAnswer('Enter a valid date.');
      }
      return text;
    }
    case 'RADIO':
    case 'DROPDOWN': {
      const id = requireText(value);
      if (!activeIds().has(id)) {
        throw new InvalidAnswer(INVALID_OPTION);
      }
      return id;
    }
    case 'CHECKBOX': {
      if (!Array.isArray(value)) {
        throw new InvalidAnswer(INVALID);
      }
      const valid = activeIds();
      const selected = new Set<string>();
      for (const item of value) {
        if (typeof item !== 'string' || !valid.has(item)) {
          throw new InvalidAnswer(INVALID_OPTION);
        }
        selected.add(item);
      }
      const min = int(config, 'minSelected');
      const max = int(config, 'maxSelected');
      const plural = (n: number) => (n === 1 ? 'option' : 'options');
      if (min !== undefined && selected.size < min) {
        throw new InvalidAnswer(`Select at least ${min} ${plural(min)}.`);
      }
      if (max !== undefined && selected.size > max) {
        throw new InvalidAnswer(`Select at most ${max} ${plural(max)}.`);
      }
      return [...selected];
    }
    case 'LINEAR_SCALE': {
      const min = scaleMin(config);
      const max = scaleMax(config);
      const n = toNumber(value);
      if (n === null || !Number.isInteger(n) || n < min || n > max) {
        throw new InvalidAnswer(`Choose a value between ${min} and ${max}.`);
      }
      return n;
    }
    default:
      throw new InvalidAnswer(INVALID);
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim().replace(',', '.');
    if (text === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
      return null;
    }
    return Number(text);
  }
  return null;
}

function requireText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidAnswer(INVALID);
  }
  return value;
}

function isEmpty(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}
