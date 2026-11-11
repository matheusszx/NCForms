export type FieldType =
  | 'SECTION_TITLE'
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'EMAIL'
  | 'NUMBER'
  | 'DATE'
  | 'RADIO'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'LINEAR_SCALE';

export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export interface FieldConfig {
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  minSelected?: number;
  maxSelected?: number;
  minLabel?: string;
  maxLabel?: string;
}

/** Choice option. Null `id` = option not saved yet. */
export interface FieldOption {
  id: string | null;
  label: string;
}

/** Form field. Null `id` = field not saved yet. */
export interface FormField {
  id: string | null;
  type: FieldType;
  label: string;
  helpText: string | null;
  required: boolean;
  config: FieldConfig;
  options: FieldOption[];
}

export interface FormSummary {
  id: string;
  title: string;
  status: FormStatus;
  slug: string;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormDetail {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: FormStatus;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  fields: FormField[];
}

export interface FormUpdateRequest {
  title: string;
  description: string | null;
  fields: FormField[];
}

export interface PublicForm {
  slug: string;
  title: string;
  description: string | null;
  fields: FormField[];
}

/** Value sent per field: text, number or list of option ids (checkbox). */
export type AnswerValue = string | number | string[];

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface ResponseSummary {
  id: string;
  number: number;
  submittedAt: string;
}

export interface AnswerItem {
  fieldId: string;
  label: string;
  type: FieldType;
  archived: boolean;
  values: string[];
}

export interface ResponseDetail {
  id: string;
  number: number;
  total: number;
  submittedAt: string;
  previousId: string | null;
  nextId: string | null;
  items: AnswerItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}
