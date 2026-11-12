import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Regular build: talks to the real Spring Boot API.
 * The GitHub Pages build replaces this file with `backend.providers.ghpages.ts`
 * (see `fileReplacements` in angular.json).
 */
export const isDemo = false;
export const extraInterceptors: HttpInterceptorFn[] = [];
export function clearDemoData(): void {}
