import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  status: number;
  message: string;
  fieldErrors: Record<string, string>;
}

/** Converts any HTTP error into the standard shape returned by the backend. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiError> | null;
    if (error.status === 0) {
      return { status: 0, message: 'Could not connect to the server.', fieldErrors: {} };
    }
    return {
      status: error.status,
      message: body?.message ?? 'An unexpected error occurred.',
      fieldErrors: body?.fieldErrors ?? {},
    };
  }
  return { status: -1, message: 'An unexpected error occurred.', fieldErrors: {} };
}
