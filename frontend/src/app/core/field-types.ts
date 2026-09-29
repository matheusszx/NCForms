import { FieldConfig, FieldType, FormStatus } from './models';
import { IconName } from '../shared/ui/icon.component';

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  icon: IconName;
  /** Recebe resposta (SECTION_TITLE é só visual). */
  isInput: boolean;
  /** Usa lista de opções. */
  hasOptions: boolean;
}

export const FIELD_TYPES: readonly FieldTypeInfo[] = [
  { type: 'SHORT_TEXT', label: 'Resposta curta', icon: 'short-text', isInput: true, hasOptions: false },
  { type: 'LONG_TEXT', label: 'Parágrafo', icon: 'paragraph', isInput: true, hasOptions: false },
  { type: 'RADIO', label: 'Múltipla escolha', icon: 'radio', isInput: true, hasOptions: true },
  { type: 'CHECKBOX', label: 'Caixas de seleção', icon: 'checkbox', isInput: true, hasOptions: true },
  { type: 'DROPDOWN', label: 'Lista suspensa', icon: 'dropdown', isInput: true, hasOptions: true },
  { type: 'LINEAR_SCALE', label: 'Escala linear', icon: 'scale', isInput: true, hasOptions: false },
  { type: 'EMAIL', label: 'E-mail', icon: 'mail', isInput: true, hasOptions: false },
  { type: 'NUMBER', label: 'Número', icon: 'hash', isInput: true, hasOptions: false },
  { type: 'DATE', label: 'Data', icon: 'calendar', isInput: true, hasOptions: false },
  { type: 'SECTION_TITLE', label: 'Título e descrição', icon: 'heading', isInput: false, hasOptions: false },
];

const BY_TYPE = new Map(FIELD_TYPES.map((t) => [t.type, t]));

export function fieldTypeInfo(type: FieldType): FieldTypeInfo {
  return BY_TYPE.get(type)!;
}

export function defaultConfig(type: FieldType): FieldConfig {
  return type === 'LINEAR_SCALE' ? { min: 1, max: 5 } : {};
}

export const SCALE_DEFAULT_MIN = 1;
export const SCALE_DEFAULT_MAX = 5;

export const STATUS_INFO: Record<FormStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Rascunho', classes: 'bg-slate-100 text-slate-700' },
  PUBLISHED: { label: 'Recebendo respostas', classes: 'bg-emerald-100 text-emerald-800' },
  CLOSED: { label: 'Fechado', classes: 'bg-amber-100 text-amber-800' },
};
