import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { catchError, defer, delay, map, mergeMap, throwError, timer } from 'rxjs';

import {
  AnswerItem,
  AuthResponse,
  FormDetail,
  FormField,
  FormSummary,
  FormUpdateRequest,
  Page,
  PublicForm,
  ResponseDetail,
  ResponseSummary,
} from '../models';
import { MockDb, MockField, MockForm, MockState, generateSlug, hashPassword, uuid } from './mock-db';
import { MockValidationError, hasOptions, isInput, validateAnswers, validateDefinition } from './mock-validators';

/**
 * In-browser replacement for the Spring Boot API, used by the GitHub Pages build.
 * It mirrors the backend rules (FormService, ResponseService, AuthService) and
 * keeps everything in localStorage, so data only exists in the current browser.
 */

class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

const FORM_NOT_FOUND = 'Form not found.';
const RESPONSE_NOT_FOUND = 'Response not found.';
const FORM_CLOSED = 'This form is no longer accepting responses.';
const REMOVED_OPTION = '(option removed)';
const SESSION_HOURS = 8;

interface Result {
  status: number;
  body: unknown;
}

type Ctx = { state: MockState; req: HttpRequest<unknown>; params: string[] };
type Handler = (ctx: Ctx) => Result | Promise<Result>;

const ok = (body: unknown, status = 200): Result => ({ status, body });

export function createMockBackendInterceptor(db: MockDb = new MockDb(), latencyMs = 150): HttpInterceptorFn {
  const routes: [string, RegExp, Handler][] = [
    ['GET', /^\/api\/auth\/config$/, () => ok({ registrationEnabled: true })],
    ['POST', /^\/api\/auth\/register$/, register],
    ['POST', /^\/api\/auth\/login$/, login],
    ['GET', /^\/api\/auth\/me$/, (c) => ok(publicUser(c.state, requireUser(c)))],
    ['GET', /^\/api\/forms$/, listForms],
    ['POST', /^\/api\/forms$/, createForm],
    ['GET', /^\/api\/forms\/([^/]+)$/, (c) => ok(toDetail(c.state, owned(c)))],
    ['PUT', /^\/api\/forms\/([^/]+)$/, updateForm],
    ['DELETE', /^\/api\/forms\/([^/]+)$/, deleteForm],
    ['POST', /^\/api\/forms\/([^/]+)\/publish$/, publishForm],
    ['POST', /^\/api\/forms\/([^/]+)\/close$/, closeForm],
    ['GET', /^\/api\/forms\/([^/]+)\/responses$/, listResponses],
    ['GET', /^\/api\/forms\/([^/]+)\/responses\/([^/]+)$/, getResponse],
    ['DELETE', /^\/api\/forms\/([^/]+)\/responses\/([^/]+)$/, deleteResponse],
    ['GET', /^\/api\/public\/forms\/([^/]+)$/, getPublicForm],
    ['POST', /^\/api\/public\/forms\/([^/]+)\/responses$/, submitResponse],
  ];

  return (req, next) => {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/')) {
      return next(req);
    }

    const run = async (): Promise<Result> => {
      for (const [method, pattern, handler] of routes) {
        const match = pattern.exec(path);
        if (match && method === req.method) {
          const state = structuredClone(db.read());
          const params = match.slice(1).map(decodeURIComponent);
          const result = await handler({ state, req, params });
          if (req.method !== 'GET') {
            db.write(state);
          }
          return result;
        }
      }
      throw new ApiFailure(404, 'Resource not found.');
    };

    return defer(run).pipe(
      map((result): HttpEvent<unknown> => new HttpResponse({ status: result.status, body: result.body, url: req.url })),
      delay(latencyMs),
      catchError((err: unknown) => timer(latencyMs).pipe(mergeMap(() => throwError(() => toHttpError(err, req.url))))),
    );
  };
}

function toHttpError(err: unknown, url: string): HttpErrorResponse {
  let failure: ApiFailure;
  if (err instanceof ApiFailure) {
    failure = err;
  } else if (err instanceof MockValidationError) {
    failure = new ApiFailure(400, err.message, err.fieldErrors);
  } else {
    console.error('[mock backend]', err);
    failure = new ApiFailure(500, 'Internal server error.');
  }
  const body: Record<string, unknown> = { status: failure.status, message: failure.message };
  if (Object.keys(failure.fieldErrors).length > 0) {
    body['fieldErrors'] = failure.fieldErrors;
  }
  return new HttpErrorResponse({ status: failure.status, statusText: String(failure.status), error: body, url });
}

// ---------------------------------------------------------------- auth

function badRequest(fieldErrors: Record<string, string>): ApiFailure {
  return new ApiFailure(400, 'Invalid data.', fieldErrors);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register({ state, req }: Ctx): Promise<Result> {
  const body = (req.body ?? {}) as { name?: string; email?: string; password?: string };
  const errors: Record<string, string> = {};
  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!name) errors['name'] = 'Enter your name.';
  else if (name.length > 120) errors['name'] = 'Name is too long.';
  if (!email) errors['email'] = 'Enter your email.';
  else if (!EMAIL.test(email) || email.length > 255) errors['email'] = 'Invalid email address.';
  if (!password.trim()) errors['password'] = 'Enter your password.';
  else if (password.length < 8 || password.length > 72)
    errors['password'] = 'Password must be between 8 and 72 characters.';
  if (Object.keys(errors).length > 0) throw badRequest(errors);

  if (state.users.some((u) => u.email === email)) {
    throw new ApiFailure(409, 'An account with this email already exists.');
  }
  const user = { id: uuid(), name, email, passwordHash: await hashPassword(password), createdAt: now() };
  state.users.push(user);
  return ok(issueSession(state, user.id), 201);
}

async function login({ state, req }: Ctx): Promise<Result> {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const errors: Record<string, string> = {};
  if (!body.email?.trim()) errors['email'] = 'Enter your email.';
  if (!body.password?.trim()) errors['password'] = 'Enter your password.';
  if (Object.keys(errors).length > 0) throw badRequest(errors);

  const email = body.email!.trim().toLowerCase();
  const user = state.users.find((u) => u.email === email);
  if (!user || user.passwordHash !== (await hashPassword(body.password!))) {
    throw new ApiFailure(401, 'Invalid email or password.');
  }
  return ok(issueSession(state, user.id));
}

function issueSession(state: MockState, userId: string): AuthResponse {
  const token = `demo.${uuid()}`;
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  for (const [key, s] of Object.entries(state.sessions)) {
    if (Date.parse(s.expiresAt) < Date.now()) delete state.sessions[key];
  }
  state.sessions[token] = { userId, expiresAt };
  return { token, expiresAt, user: publicUser(state, userId) };
}

function publicUser(state: MockState, userId: string) {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new ApiFailure(401, 'Invalid session.');
  return { id: u.id, name: u.name, email: u.email };
}

function requireUser({ state, req }: Ctx): string {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = state.sessions[token];
  if (!session || Date.parse(session.expiresAt) < Date.now() || !state.users.some((u) => u.id === session.userId)) {
    throw new ApiFailure(401, 'Unauthorized.');
  }
  return session.userId;
}

// ---------------------------------------------------------------- forms

function now(): string {
  return new Date().toISOString();
}

function blankToNull(value: string | null | undefined): string | null {
  return value == null || value.trim() === '' ? null : value.trim();
}

function owned(ctx: Ctx): MockForm {
  const userId = requireUser(ctx);
  const form = ctx.state.forms.find((f) => f.id === ctx.params[0] && f.ownerId === userId);
  if (!form) throw new ApiFailure(404, FORM_NOT_FOUND);
  return form;
}

const countResponses = (state: MockState, formId: string) =>
  state.responses.filter((r) => r.formId === formId).length;

const activeFields = (form: MockForm) =>
  form.fields.filter((f) => !f.archived).sort((a, b) => a.position - b.position);

function toFieldDto(field: MockField): FormField {
  return {
    id: field.id,
    type: field.type,
    label: field.label,
    helpText: field.helpText,
    required: field.required,
    config: field.config,
    options: field.options
      .filter((o) => !o.archived)
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label })),
  };
}

function toSummary(state: MockState, f: MockForm): FormSummary {
  return {
    id: f.id,
    title: f.title,
    status: f.status,
    slug: f.slug,
    responseCount: countResponses(state, f.id),
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

function toDetail(state: MockState, f: MockForm): FormDetail {
  return { ...toSummary(state, f), description: f.description, fields: activeFields(f).map(toFieldDto) };
}

function listForms(ctx: Ctx): Result {
  const userId = requireUser(ctx);
  const forms = ctx.state.forms
    .filter((f) => f.ownerId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return ok(forms.map((f) => toSummary(ctx.state, f)));
}

function createForm(ctx: Ctx): Result {
  const userId = requireUser(ctx);
  const body = (ctx.req.body ?? {}) as { title?: string; description?: string };
  const errors: Record<string, string> = {};
  if (body.title && body.title.length > 200) errors['title'] = 'Title is too long.';
  if (body.description && body.description.length > 5000) errors['description'] = 'Description is too long.';
  if (Object.keys(errors).length > 0) throw badRequest(errors);

  const timestamp = now();
  const form: MockForm = {
    id: uuid(),
    ownerId: userId,
    title: blankToNull(body.title) ?? 'Untitled form',
    description: blankToNull(body.description),
    slug: generateSlug((s) => ctx.state.forms.some((f) => f.slug === s)),
    status: 'DRAFT',
    createdAt: timestamp,
    updatedAt: timestamp,
    fields: [],
  };
  ctx.state.forms.push(form);
  return ok(toDetail(ctx.state, form), 201);
}

function updateForm(ctx: Ctx): Result {
  const form = owned(ctx);
  const body = (ctx.req.body ?? {}) as Partial<FormUpdateRequest>;
  const errors: Record<string, string> = {};
  if (!body.title?.trim()) errors['title'] = 'Enter a form title.';
  else if (body.title.length > 200) errors['title'] = 'Title is too long.';
  if (body.description && body.description.length > 5000) errors['description'] = 'Description is too long.';
  if (!Array.isArray(body.fields)) errors['fields'] = 'must not be null';
  else if (body.fields.length > 200) errors['fields'] = 'Limit of 200 fields per form.';
  else if (body.fields.some((f) => !f?.type)) {
    body.fields.forEach((f, i) => {
      if (!f?.type) errors[`fields[${i}].type`] = 'Enter the field type.';
    });
  }
  if (Object.keys(errors).length > 0) throw badRequest(errors);

  const fields = validateDefinition(body.fields!);
  form.title = body.title!.trim();
  form.description = blankToNull(body.description);
  syncFields(ctx.state, form, fields);
  form.updatedAt = now();
  return ok(toDetail(ctx.state, form));
}

/** Port of FormService.syncFields: match by id, archive removed items that already have answers. */
function syncFields(state: MockState, form: MockForm, dtos: FormField[]): void {
  const hasAnswers = (fieldId: string) =>
    state.responses.some((r) => r.formId === form.id && r.answers[fieldId] !== undefined);
  const existing = new Map(activeFields(form).map((f) => [f.id, f]));
  const kept = new Set<string>();
  let position = 0;

  for (const dto of dtos) {
    let field = dto.id ? existing.get(dto.id) : undefined;
    if (field && kept.has(field.id)) {
      field = undefined;
    }
    if (field && field.type !== dto.type) {
      if (hasAnswers(field.id)) {
        field = undefined;
      } else {
        field.type = dto.type;
      }
    }
    if (!field) {
      field = {
        id: uuid(),
        type: dto.type,
        label: '',
        helpText: null,
        required: false,
        config: {},
        position: 0,
        archived: false,
        options: [],
      };
      form.fields.push(field);
    } else {
      kept.add(field.id);
    }
    field.position = position++;
    field.label = dto.label;
    field.helpText = dto.helpText;
    field.required = dto.required === true;
    field.config = dto.config;
    syncOptions(field, hasOptions(dto.type) ? dto.options : [], hasAnswers(field.id));
  }

  for (const old of existing.values()) {
    if (kept.has(old.id)) continue;
    if (hasAnswers(old.id)) {
      old.archived = true;
    } else {
      form.fields = form.fields.filter((f) => f !== old);
    }
  }
}

function syncOptions(field: MockField, dtos: FormField['options'], fieldHasAnswers: boolean): void {
  const existing = new Map(field.options.filter((o) => !o.archived).map((o) => [o.id, o]));
  const kept = new Set<string>();
  let position = 0;
  for (const dto of dtos) {
    let option = dto.id ? existing.get(dto.id) : undefined;
    if (option && kept.has(option.id)) {
      option = undefined;
    }
    if (!option) {
      option = { id: uuid(), label: dto.label, position: 0, archived: false };
      field.options.push(option);
    } else {
      kept.add(option.id);
      option.label = dto.label;
    }
    option.position = position++;
  }
  for (const old of existing.values()) {
    if (kept.has(old.id)) continue;
    if (fieldHasAnswers) {
      old.archived = true;
    } else {
      field.options = field.options.filter((o) => o !== old);
    }
  }
}

function deleteForm(ctx: Ctx): Result {
  const form = owned(ctx);
  ctx.state.forms = ctx.state.forms.filter((f) => f.id !== form.id);
  ctx.state.responses = ctx.state.responses.filter((r) => r.formId !== form.id);
  return ok(null, 204);
}

function publishForm(ctx: Ctx): Result {
  const form = owned(ctx);
  if (!activeFields(form).some((f) => isInput(f.type))) {
    throw new ApiFailure(400, 'Add at least one question before publishing.');
  }
  form.status = 'PUBLISHED';
  form.updatedAt = now();
  return ok(toDetail(ctx.state, form));
}

function closeForm(ctx: Ctx): Result {
  const form = owned(ctx);
  if (form.status === 'DRAFT') {
    throw new ApiFailure(400, 'Only published forms can be closed.');
  }
  form.status = 'CLOSED';
  form.updatedAt = now();
  return ok(toDetail(ctx.state, form));
}

// ---------------------------------------------------------------- responses

/** Chronological order (oldest first), ties broken by id, like the SQL tuple comparison. */
function chronological(state: MockState, formId: string) {
  return state.responses
    .filter((r) => r.formId === formId)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
}

function listResponses(ctx: Ctx): Result {
  const form = owned(ctx);
  const page = Math.max(Number(ctx.req.params.get('page') ?? 0) || 0, 0);
  const size = Math.min(Math.max(Number(ctx.req.params.get('size') ?? 20) || 20, 1), 100);
  const newestFirst = chronological(ctx.state, form.id).reverse();
  const total = newestFirst.length;
  const offset = page * size;
  const items: ResponseSummary[] = newestFirst
    .slice(offset, offset + size)
    .map((r, i) => ({ id: r.id, number: total - offset - i, submittedAt: r.submittedAt }));
  const result: Page<ResponseSummary> = {
    items,
    page,
    size,
    totalItems: total,
    totalPages: Math.ceil(total / size),
  };
  return ok(result);
}

function getResponse(ctx: Ctx): Result {
  const form = owned(ctx);
  const ordered = chronological(ctx.state, form.id);
  const index = ordered.findIndex((r) => r.id === ctx.params[1]);
  if (index < 0) throw new ApiFailure(404, RESPONSE_NOT_FOUND);
  const response = ordered[index];

  const items: AnswerItem[] = [];
  for (const field of [...form.fields].sort((a, b) => a.position - b.position)) {
    if (!isInput(field.type)) continue;
    const value = response.answers[field.id];
    if (field.archived && value === undefined) continue;
    items.push({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      archived: field.archived,
      values: displayValues(field, value),
    });
  }

  const detail: ResponseDetail = {
    id: response.id,
    number: index + 1,
    total: ordered.length,
    submittedAt: response.submittedAt,
    previousId: ordered[index - 1]?.id ?? null,
    nextId: ordered[index + 1]?.id ?? null,
    items,
  };
  return ok(detail);
}

function displayValues(field: MockField, value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (hasOptions(field.type)) {
    const labels = new Map(field.options.map((o) => [o.id, o.label]));
    const toLabel = (v: unknown) => labels.get(String(v)) ?? REMOVED_OPTION;
    return Array.isArray(value) ? value.map(toLabel) : [toLabel(value)];
  }
  return [String(value)];
}

function deleteResponse(ctx: Ctx): Result {
  const form = owned(ctx);
  const exists = ctx.state.responses.some((r) => r.id === ctx.params[1] && r.formId === form.id);
  if (!exists) throw new ApiFailure(404, RESPONSE_NOT_FOUND);
  ctx.state.responses = ctx.state.responses.filter((r) => r.id !== ctx.params[1]);
  return ok(null, 204);
}

// ---------------------------------------------------------------- public

function acceptingResponses(state: MockState, slug: string): MockForm {
  const form = state.forms.find((f) => f.slug === slug && f.status !== 'DRAFT');
  if (!form) throw new ApiFailure(404, FORM_NOT_FOUND);
  if (form.status === 'CLOSED') throw new ApiFailure(410, FORM_CLOSED);
  return form;
}

function getPublicForm({ state, params }: Ctx): Result {
  const form = acceptingResponses(state, params[0]);
  const dto: PublicForm = {
    slug: form.slug,
    title: form.title,
    description: form.description,
    fields: activeFields(form).map(toFieldDto),
  };
  return ok(dto);
}

function submitResponse({ state, params, req }: Ctx): Result {
  const form = acceptingResponses(state, params[0]);
  const body = (req.body ?? {}) as { answers?: Record<string, unknown> };
  const answers = validateAnswers(activeFields(form), body.answers);
  const id = uuid();
  state.responses.push({ id, formId: form.id, submittedAt: now(), answers });
  return ok({ id }, 201);
}

/** Singleton used by the GitHub Pages build. */
export const mockDb = new MockDb();
export const mockBackendInterceptor: HttpInterceptorFn = createMockBackendInterceptor(mockDb);
