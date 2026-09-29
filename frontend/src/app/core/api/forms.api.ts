import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnswerValue,
  FormDetail,
  FormSummary,
  FormUpdateRequest,
  Page,
  PublicForm,
  ResponseDetail,
  ResponseSummary,
} from '../models';

@Injectable({ providedIn: 'root' })
export class FormsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<FormSummary[]> {
    return this.http.get<FormSummary[]>('/api/forms');
  }

  create(title?: string): Observable<FormDetail> {
    return this.http.post<FormDetail>('/api/forms', { title: title ?? null });
  }

  get(id: string): Observable<FormDetail> {
    return this.http.get<FormDetail>(`/api/forms/${id}`);
  }

  update(id: string, body: FormUpdateRequest): Observable<FormDetail> {
    return this.http.put<FormDetail>(`/api/forms/${id}`, body);
  }

  publish(id: string): Observable<FormDetail> {
    return this.http.post<FormDetail>(`/api/forms/${id}/publish`, null);
  }

  close(id: string): Observable<FormDetail> {
    return this.http.post<FormDetail>(`/api/forms/${id}/close`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/forms/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ResponsesApi {
  private readonly http = inject(HttpClient);

  list(formId: string, page: number, size = 20): Observable<Page<ResponseSummary>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<ResponseSummary>>(`/api/forms/${formId}/responses`, { params });
  }

  get(formId: string, responseId: string): Observable<ResponseDetail> {
    return this.http.get<ResponseDetail>(`/api/forms/${formId}/responses/${responseId}`);
  }

  delete(formId: string, responseId: string): Observable<void> {
    return this.http.delete<void>(`/api/forms/${formId}/responses/${responseId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);

  getForm(slug: string): Observable<PublicForm> {
    return this.http.get<PublicForm>(`/api/public/forms/${encodeURIComponent(slug)}`);
  }

  submit(slug: string, answers: Record<string, AnswerValue>): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`/api/public/forms/${encodeURIComponent(slug)}/responses`, { answers });
  }
}
