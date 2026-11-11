import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/** Attaches the token to authenticated API calls and handles expired sessions (401). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isPrivateApi = req.url.startsWith('/api/') && !req.url.startsWith('/api/public/');
  const isAuthCall = req.url.startsWith('/api/auth/') && !req.url.startsWith('/api/auth/me');

  const token = isPrivateApi && !isAuthCall ? auth.token() : null;
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && isPrivateApi && !isAuthCall) {
        auth.handleUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
