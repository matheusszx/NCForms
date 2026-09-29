import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  status: number;
  message: string;
  fieldErrors: Record<string, string>;
}

/** Converte qualquer erro HTTP no formato padronizado retornado pelo backend. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiError> | null;
    if (error.status === 0) {
      return { status: 0, message: 'Não foi possível conectar ao servidor.', fieldErrors: {} };
    }
    return {
      status: error.status,
      message: body?.message ?? 'Ocorreu um erro inesperado.',
      fieldErrors: body?.fieldErrors ?? {},
    };
  }
  return { status: -1, message: 'Ocorreu um erro inesperado.', fieldErrors: {} };
}
