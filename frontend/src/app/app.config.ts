import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { extraInterceptors } from './core/mock/backend.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // extraInterceptors is empty in the regular build; the GitHub Pages build adds the in-browser mock API.
    provideHttpClient(withInterceptors([authInterceptor, ...extraInterceptors])),
  ],
};
