import { AnswerValue, FieldConfig, FieldType, FormStatus } from '../models';

/** Records persisted by the in-browser demo backend (GitHub Pages build only). */
export interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface MockOption {
  id: string;
  label: string;
  position: number;
  archived: boolean;
}

export interface MockField {
  id: string;
  type: FieldType;
  label: string;
  helpText: string | null;
  required: boolean;
  config: FieldConfig;
  position: number;
  archived: boolean;
  options: MockOption[];
}

export interface MockForm {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  slug: string;
  status: FormStatus;
  createdAt: string;
  updatedAt: string;
  fields: MockField[];
}

export interface MockResponse {
  id: string;
  formId: string;
  submittedAt: string;
  /** Normalized answer per field id. */
  answers: Record<string, AnswerValue>;
}

export interface MockSession {
  userId: string;
  expiresAt: string;
}

export interface MockState {
  users: MockUser[];
  forms: MockForm[];
  responses: MockResponse[];
  sessions: Record<string, MockSession>;
}

export const MOCK_DB_KEY = 'ncforms.mockdb';

function emptyState(): MockState {
  return { users: [], forms: [], responses: [], sessions: {} };
}

/** Small localStorage-backed store. Falls back to memory when storage is unavailable. */
export class MockDb {
  private memory: MockState | null = null;

  constructor(private readonly storage: Storage | null = safeLocalStorage()) {}

  read(): MockState {
    if (this.memory) {
      return this.memory;
    }
    let state = emptyState();
    try {
      const raw = this.storage?.getItem(MOCK_DB_KEY);
      if (raw) {
        state = { ...state, ...(JSON.parse(raw) as Partial<MockState>) };
      }
    } catch {
      // corrupted or blocked storage: start fresh
    }
    this.memory = state;
    return state;
  }

  write(state: MockState): void {
    this.memory = state;
    try {
      this.storage?.setItem(MOCK_DB_KEY, JSON.stringify(state));
    } catch {
      // quota exceeded or blocked: keep the in-memory copy
    }
  }

  clear(): void {
    this.memory = null;
    try {
      this.storage?.removeItem(MOCK_DB_KEY);
    } catch {
      // ignore
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function uuid(): string {
  return crypto.randomUUID();
}

const SLUG_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SLUG_LENGTH = 10;

/** Same alphabet and length as the backend's SlugGenerator. */
export function generateSlug(exists: (slug: string) => boolean): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.getRandomValues(new Uint32Array(SLUG_LENGTH));
    const slug = Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('');
    if (!exists(slug)) {
      return slug;
    }
  }
  throw new Error('Could not generate a unique link.');
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`ncforms-demo:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
