import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { toApiError } from '../../core/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout heading="Criar conta" subheading="Comece a criar formulários em poucos minutos.">
      @if (registrationEnabled() === false) {
        <div class="flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-3 text-sm text-slate-700">
          <app-icon name="lock" [size]="18" />
          O cadastro de novas contas está desativado neste servidor. Fale com o administrador.
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          <div>
            <label class="label" for="name">Nome</label>
            <input id="name" class="input" formControlName="name" autocomplete="name"
                   [class.input-invalid]="fieldError('name')" />
            @if (fieldError('name'); as msg) { <p class="field-error">{{ msg }}</p> }
          </div>
          <div>
            <label class="label" for="email">E-mail</label>
            <input id="email" type="email" class="input" formControlName="email" autocomplete="email"
                   [class.input-invalid]="fieldError('email')" />
            @if (fieldError('email'); as msg) { <p class="field-error">{{ msg }}</p> }
          </div>
          <div>
            <label class="label" for="password">Senha</label>
            <input id="password" type="password" class="input" formControlName="password" autocomplete="new-password"
                   [class.input-invalid]="fieldError('password')" />
            @if (fieldError('password'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="mt-1 text-xs text-slate-500">Mínimo de 8 caracteres.</p>
            }
          </div>
          @if (error()) {
            <p class="field-error" role="alert"><app-icon name="alert" [size]="16" />{{ error() }}</p>
          }
          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? 'Criando conta…' : 'Criar conta' }}
          </button>
        </form>
      }
      <p class="mt-6 text-center text-sm text-slate-600">
        Já tem conta?
        <a routerLink="/login" class="font-medium text-brand-700 hover:underline">Entrar</a>
      </p>
    </app-auth-layout>
  `,
})
export class RegisterPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly serverErrors = signal<Record<string, string>>({});
  protected readonly registrationEnabled = signal<boolean | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  ngOnInit(): void {
    this.auth.registrationEnabled().subscribe({
      next: (enabled) => this.registrationEnabled.set(enabled),
      error: () => this.registrationEnabled.set(null),
    });
  }

  protected fieldError(name: 'name' | 'email' | 'password'): string | null {
    const server = this.serverErrors()[name];
    if (server) {
      return server;
    }
    const control = this.form.controls[name];
    if (!this.submitted() || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Campo obrigatório.';
    }
    if (control.hasError('email')) {
      return 'E-mail inválido.';
    }
    if (control.hasError('minlength')) {
      return 'A senha deve ter pelo menos 8 caracteres.';
    }
    return 'Valor muito longo.';
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.error.set(null);
    if (this.form.invalid) {
      return;
    }
    this.loading.set(true);
    const { name, email, password } = this.form.getRawValue();
    this.auth.register(name, email, password).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (err) => {
        const apiError = toApiError(err);
        this.loading.set(false);
        this.serverErrors.set(apiError.fieldErrors);
        if (Object.keys(apiError.fieldErrors).length === 0) {
          this.error.set(apiError.message);
        }
      },
    });
  }
}
