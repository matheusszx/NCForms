import { HttpInterceptorFn } from '@angular/common/http';

import { mockBackendInterceptor, mockDb } from './mock-backend.interceptor';

/** GitHub Pages build: no server, the API is emulated in the browser (localStorage). */
export const isDemo = true;
export const extraInterceptors: HttpInterceptorFn[] = [mockBackendInterceptor];
export function clearDemoData(): void {
  mockDb.clear();
  try {
    localStorage.removeItem('ncforms.session');
  } catch {
    // ignore
  }
}
