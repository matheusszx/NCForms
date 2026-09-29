import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar · NCForms',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Criar conta · NCForms',
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'f/:slug',
    title: 'Formulário · NCForms',
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
        title: 'Meus formulários · NCForms',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'forms/:id/edit',
        title: 'Editar formulário · NCForms',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/builder/builder.page').then((m) => m.BuilderPage),
      },
      {
        path: 'forms/:id/results',
        title: 'Respostas · NCForms',
        loadComponent: () => import('./features/results/results.page').then((m) => m.ResultsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
