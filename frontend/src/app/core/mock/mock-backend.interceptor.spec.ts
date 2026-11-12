import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AuthResponse, FormDetail, Page, PublicForm, ResponseDetail, ResponseSummary } from '../models';
import { createMockBackendInterceptor } from './mock-backend.interceptor';
import { MockDb } from './mock-db';

describe('mock backend interceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([createMockBackendInterceptor(new MockDb(null), 0)]))],
    });
    http = TestBed.inject(HttpClient);
  });

  const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

  async function fail(promise: Promise<unknown>): Promise<HttpErrorResponse> {
    try {
      await promise;
    } catch (e) {
      return e as HttpErrorResponse;
    }
    throw new Error('expected request to fail');
  }

  async function register(email = 'ana@example.com'): Promise<string> {
    const res = await firstValueFrom(
      http.post<AuthResponse>('/api/auth/register', { name: 'Ana', email, password: 'secret123' }),
    );
    return res.token;
  }

  it('runs the full create → publish → answer → results flow', async () => {
    const token = await register();
    const created = await firstValueFrom(http.post<FormDetail>('/api/forms', {}, auth(token)));
    expect(created.title).toBe('Untitled form');
    expect(created.slug).toMatch(/^[a-zA-Z2-9]{10}$/);

    // Publishing an empty form is rejected.
    const empty = await fail(firstValueFrom(http.post(`/api/forms/${created.id}/publish`, null, auth(token))));
    expect(empty.status).toBe(400);

    const updated = await firstValueFrom(
      http.put<FormDetail>(
        `/api/forms/${created.id}`,
        {
          title: ' Survey ',
          description: '',
          fields: [
            { id: null, type: 'SHORT_TEXT', label: 'Name', helpText: null, required: true, config: {}, options: [] },
            {
              id: null,
              type: 'RADIO',
              label: 'Color',
              helpText: null,
              required: false,
              config: {},
              options: [
                { id: null, label: 'Blue' },
                { id: null, label: 'Red' },
              ],
            },
          ],
        },
        auth(token),
      ),
    );
    expect(updated.title).toBe('Survey');
    expect(updated.description).toBeNull();
    const [name, color] = updated.fields;
    expect(color.options.map((o) => o.label)).toEqual(['Blue', 'Red']);

    // Drafts are not public.
    const draft = await fail(firstValueFrom(http.get(`/api/public/forms/${created.slug}`)));
    expect(draft.status).toBe(404);

    await firstValueFrom(http.post(`/api/forms/${created.id}/publish`, null, auth(token)));
    const pub = await firstValueFrom(http.get<PublicForm>(`/api/public/forms/${created.slug}`));
    expect(pub.fields.length).toBe(2);

    // Validation errors are keyed by field id.
    const invalid = await fail(
      firstValueFrom(http.post(`/api/public/forms/${created.slug}/responses`, { answers: { [color.id!]: 'nope' } })),
    );
    expect(invalid.status).toBe(400);
    expect(invalid.error.fieldErrors).toEqual({ [name.id!]: 'This question is required.', [color.id!]: 'Invalid option.' });

    await firstValueFrom(
      http.post(`/api/public/forms/${created.slug}/responses`, {
        answers: { [name.id!]: ' Bea ', [color.id!]: color.options[0].id },
      }),
    );

    const page = await firstValueFrom(
      http.get<Page<ResponseSummary>>(`/api/forms/${created.id}/responses?page=0&size=20`, auth(token)),
    );
    expect(page.totalItems).toBe(1);
    expect(page.items[0].number).toBe(1);

    const detail = await firstValueFrom(
      http.get<ResponseDetail>(`/api/forms/${created.id}/responses/${page.items[0].id}`, auth(token)),
    );
    expect(detail.items.map((i) => i.values)).toEqual([['Bea'], ['Blue']]);
    expect(detail.previousId).toBeNull();

    // Removing an answered field archives it instead of deleting it.
    await firstValueFrom(
      http.put<FormDetail>(
        `/api/forms/${created.id}`,
        { title: 'Survey', description: null, fields: [updated.fields[0]] },
        auth(token),
      ),
    );
    const afterRemoval = await firstValueFrom(
      http.get<ResponseDetail>(`/api/forms/${created.id}/responses/${page.items[0].id}`, auth(token)),
    );
    expect(afterRemoval.items[1]).toMatchObject({ label: 'Color', archived: true, values: ['Blue'] });

    await firstValueFrom(http.post(`/api/forms/${created.id}/close`, null, auth(token)));
    const closed = await fail(firstValueFrom(http.get(`/api/public/forms/${created.slug}`)));
    expect(closed.status).toBe(410);
  });

  it('isolates forms between users and requires a session', async () => {
    const ana = await register('ana@example.com');
    const bob = await register('bob@example.com');
    const form = await firstValueFrom(http.post<FormDetail>('/api/forms', { title: 'Private' }, auth(ana)));

    const other = await fail(firstValueFrom(http.get(`/api/forms/${form.id}`, auth(bob))));
    expect(other.status).toBe(404);

    const anonymous = await fail(firstValueFrom(http.get('/api/forms')));
    expect(anonymous.status).toBe(401);
  });

  it('rejects duplicate emails and wrong passwords', async () => {
    await register();
    const duplicate = await fail(
      firstValueFrom(http.post('/api/auth/register', { name: 'A', email: 'ANA@example.com', password: 'secret123' })),
    );
    expect(duplicate.status).toBe(409);

    const wrong = await fail(firstValueFrom(http.post('/api/auth/login', { email: 'ana@example.com', password: 'x' })));
    expect(wrong.status).toBe(401);
    expect(wrong.error.message).toBe('Invalid email or password.');

    const login = await firstValueFrom(
      http.post<AuthResponse>('/api/auth/login', { email: 'ana@example.com', password: 'secret123' }),
    );
    expect(login.user.name).toBe('Ana');
  });
});
