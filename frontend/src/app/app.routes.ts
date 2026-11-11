import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · NCForms',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Create account · NCForms',
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'f/:slug',
    title: 'Form · NCForms',
    loadComponent: () => import('./features/public-form/public-form.page').then((m) => m.PublicFormPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'My forms · NCForms',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'forms/:id/edit',
        title: 'Edit form · NCForms',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/builder/builder.page').then((m) => m.BuilderPage),
      },
      {
        path: 'forms/:id/results',
        title: 'Responses · NCForms',
        loadComponent: () => import('./features/results/results.page').then((m) => m.ResultsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
