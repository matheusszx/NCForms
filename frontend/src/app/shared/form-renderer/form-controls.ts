import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

import { SCALE_DEFAULT_MAX, SCALE_DEFAULT_MIN, fieldTypeInfo } from '../../core/field-types';
import { AnswerValue, FormField } from '../../core/models';

/** Campo pronto para renderização; `key` identifica o controle e a resposta enviada (id do campo). */
export type RenderField = FormField & { key: string };

export const DEFAULT_SHORT_TEXT_MAX_LENGTH = 500;
export const DEFAULT_LONG_TEXT_MAX_LENGTH = 10000;

// Mesmo critério do backend (AnswerValidator).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isInputField(field: FormField): boolean {
  return fieldTypeInfo(field.type).isInput;
}

export function scaleRange(field: FormField): number[] {
  const min = field.config.min ?? SCALE_DEFAULT_MIN;
  const max = field.config.max ?? SCALE_DEFAULT_MAX;
  const values: number[] = [];
  for (let n = min; n <= max; n++) {
    values.push(n);
  }
  return values;
}

export function textMaxLength(field: FormField): number {
  return (
    field.config.maxLength ??
    (field.type === 'LONG_TEXT' ? DEFAULT_LONG_TEXT_MAX_LENGTH : DEFAULT_SHORT_TEXT_MAX_LENGTH)
  );
}

/** Cria o FormGroup com um controle por pergunta e os validadores equivalentes aos do backend. */
export function buildFormGroup(fields: RenderField[]): FormGroup<Record<string, FormControl>> {
  const controls: Record<string, FormControl> = {};
  for (const field of fields) {
    if (isInputField(field)) {
      controls[field.key] = new FormControl(field.type === 'CHECKBOX' ? [] : null, validatorsFor(field));
    }
  }
  return new FormGroup(controls);
}

export function validatorsFor(field: FormField): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  if (field.required) {
    validators.push(requiredValue);
  }
  switch (field.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
      validators.push(maxTextLength(textMaxLength(field)));
      break;
    case 'EMAIL':
      validators.push(emailValue);
      break;
    case 'NUMBER':
      validators.push(numberRange(field.config.min, field.config.max));
      break;
    case 'CHECKBOX':
      validators.push(selectionLimits(field.config.minSelected, field.config.maxSelected));
      break;
  }
  return validators;
}

export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

export const requiredValue: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  isEmptyValue(control.value) ? { required: true } : null;

const emailValue: ValidatorFn = (control) =>
  isEmptyValue(control.value) || EMAIL_PATTERN.test(String(control.value).trim()) ? null : { email: true };

function maxTextLength(max: number): ValidatorFn {
  return (control) =>
    typeof control.value === 'string' && control.value.trim().length > max ? { maxlength: { max } } : null;
}

function numberRange(min: number | undefined, max: number | undefined): ValidatorFn {
  return (control) => {
    const value = control.value;
    if (isEmptyValue(value)) {
      return null;
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (Number.isNaN(n)) {
      return { number: true };
    }
    if (min !== undefined && n < min) {
      return { min: { min } };
    }
    if (max !== undefined && n > max) {
      return { max: { max } };
    }
    return null;
  };
}

function selectionLimits(min: number | undefined, max: number | undefined): ValidatorFn {
  return (control) => {
    const selected = Array.isArray(control.value) ? control.value.length : 0;
    if (selected === 0) {
      return null; // "obrigatório" é tratado por requiredValue
    }
    if (min !== undefined && selected < min) {
      return { minSelected: min };
    }
    if (max !== undefined && selected > max) {
      return { maxSelected: max };
    }
    return null;
  };
}

export function errorMessage(errors: ValidationErrors | null): string | null {
  if (!errors) {
    return null;
  }
  if (errors['required']) {
    return 'Esta pergunta é obrigatória.';
  }
  if (errors['email']) {
    return 'Informe um e-mail válido.';
  }
  if (errors['number']) {
    return 'Informe um número válido.';
  }
  if (errors['min']) {
    return `O valor deve ser no mínimo ${errors['min'].min}.`;
  }
  if (errors['max']) {
    return `O valor deve ser no máximo ${errors['max'].max}.`;
  }
  if (errors['maxlength']) {
    return `A resposta deve ter no máximo ${errors['maxlength'].max} caracteres.`;
  }
  if (errors['minSelected']) {
    return `Selecione pelo menos ${errors['minSelected']} ${errors['minSelected'] === 1 ? 'opção' : 'opções'}.`;
  }
  if (errors['maxSelected']) {
    return `Selecione no máximo ${errors['maxSelected']} ${errors['maxSelected'] === 1 ? 'opção' : 'opções'}.`;
  }
  return 'Resposta inválida.';
}

/** Monta o payload enviado à API, omitindo perguntas não respondidas. */
export function collectAnswers(fields: RenderField[], values: Record<string, unknown>): Record<string, AnswerValue> {
  const answers: Record<string, AnswerValue> = {};
  for (const field of fields) {
    if (!isInputField(field)) {
      continue;
    }
    const value = values[field.key];
    if (isEmptyValue(value)) {
      continue;
    }
    switch (field.type) {
      case 'CHECKBOX':
        answers[field.key] = [...(value as string[])];
        break;
      case 'NUMBER':
      case 'LINEAR_SCALE':
        answers[field.key] = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
        break;
      default:
        answers[field.key] = String(value).trim();
    }
  }
  return answers;
}
