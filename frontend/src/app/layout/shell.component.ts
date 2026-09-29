import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { IconComponent } from '../shared/ui/icon.component';
import { LogoComponent } from '../shared/ui/logo.component';

/** Layout da área logada: cabeçalho com logo e usuário. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, IconComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a routerLink="/" aria-label="Início"><app-logo /></a>
        @if (auth.user(); as user) {
          <div class="flex items-center gap-3">
            <span class="hidden text-sm text-slate-600 sm:inline">{{ user.name }}</span>
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
              [title]="user.email"
            >
              {{ user.name.charAt(0).toUpperCase() }}
            </span>
            <button type="button" class="icon-btn" (click)="auth.logout()" title="Sair" aria-label="Sair">
              <app-icon name="logout" [size]="18" />
            </button>
          </div>
        }
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
}
