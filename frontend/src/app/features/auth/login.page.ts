import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { toApiError } from '../../core/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout heading="Entrar" subheading="Acesse para criar e gerenciar seus formulários.">
      @if (expired()) {
        <div class="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <app-icon name="info" [size]="16" /> Sua sessão expirou. Entre novamente.
        </div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
        <div>
          <label class="label" for="email">E-mail</label>
          <input id="email" type="email" class="input" formControlName="email" autocomplete="email" />
        </div>
        <div>
          <label class="label" for="password">Senha</label>
          <input id="password" type="password" class="input" formControlName="password" autocomplete="current-password" />
        </div>
        @if (error()) {
          <p class="field-error" role="alert"><app-icon name="alert" [size]="16" />{{ error() }}</p>
        }
        <button type="submit" class="btn-primary w-full" [disabled]="loading()">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      @if (registrationEnabled()) {
        <p class="mt-6 text-center text-sm text-slate-600">
          Não tem conta?
          <a routerLink="/register" class="font-medium text-brand-700 hover:underline">Criar conta</a>
        </p>
      }
    </app-auth-layout>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query params ligados via withComponentInputBinding. */
  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly registrationEnabled = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    this.auth.registrationEnabled().subscribe({
      next: (enabled) => this.registrationEnabled.set(enabled),
      error: () => this.registrationEnabled.set(false),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('Informe e-mail e senha.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (err) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

/** Aceita apenas caminhos internos para evitar redirecionamento aberto. */
export function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
