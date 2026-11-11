import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7 18V6l10 12V6" />
      </svg>
    </span>
    <span class="text-lg font-semibold tracking-tight text-slate-900">NC<span class="text-brand-600">Forms</span></span>
  `,
})
export class LogoComponent {}
