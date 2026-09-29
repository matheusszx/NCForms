import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LogoComponent } from '../../shared/ui/logo.component';

@Component({
  selector: 'app-auth-layout',
  imports: [LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-12">
      <app-logo class="mb-8" />
      <div class="card w-full max-w-sm p-8">
        <h1 class="text-xl font-semibold text-slate-900">{{ heading() }}</h1>
        <p class="mt-1 text-sm text-slate-500">{{ subheading() }}</p>
        <div class="mt-6">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {
  readonly heading = input.required<string>();
  readonly subheading = input('');
}
