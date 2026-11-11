import { FieldConfig, FieldType, FormStatus } from './models';
import { IconName } from '../shared/ui/icon.component';

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  icon: IconName;
  /** Accepts an answer (SECTION_TITLE is visual only). */
  isInput: boolean;
  /** Uses a list of options. */
  hasOptions: boolean;
}

export const FIELD_TYPES: readonly FieldTypeInfo[] = [
  { type: 'SHORT_TEXT', label: 'Short answer', icon: 'short-text', isInput: true, hasOptions: false },
  { type: 'LONG_TEXT', label: 'Paragraph', icon: 'paragraph', isInput: true, hasOptions: false },
  { type: 'RADIO', label: 'Multiple choice', icon: 'radio', isInput: true, hasOptions: true },
  { type: 'CHECKBOX', label: 'Checkboxes', icon: 'checkbox', isInput: true, hasOptions: true },
  { type: 'DROPDOWN', label: 'Dropdown', icon: 'dropdown', isInput: true, hasOptions: true },
  { type: 'LINEAR_SCALE', label: 'Linear scale', icon: 'scale', isInput: true, hasOptions: false },
  { type: 'EMAIL', label: 'Email', icon: 'mail', isInput: true, hasOptions: false },
  { type: 'NUMBER', label: 'Number', icon: 'hash', isInput: true, hasOptions: false },
  { type: 'DATE', label: 'Date', icon: 'calendar', isInput: true, hasOptions: false },
  { type: 'SECTION_TITLE', label: 'Title and description', icon: 'heading', isInput: false, hasOptions: false },
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
  DRAFT: { label: 'Draft', classes: 'bg-slate-100 text-slate-700' },
  PUBLISHED: { label: 'Accepting responses', classes: 'bg-emerald-100 text-emerald-800' },
  CLOSED: { label: 'Closed', classes: 'bg-amber-100 text-amber-800' },
};
