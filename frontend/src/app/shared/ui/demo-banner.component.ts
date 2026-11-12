import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmService } from '../../core/confirm.service';
import { clearDemoData, isDemo } from '../../core/mock/backend.providers';
import { IconComponent } from './icon.component';

/** Notice shown only in the GitHub Pages build, where the API runs inside the browser. */
@Component({
  selector: 'app-demo-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isDemo) {
      <div class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900" role="note">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p class="flex items-center gap-2">
            <app-icon name="info" [size]="16" />
            <span><strong>Demo mode:</strong> there is no server. Everything you create is saved only in this browser.</span>
          </p>
          <button type="button" class="font-medium underline-offset-2 hover:underline" (click)="reset()">
            Clear demo data
          </button>
        </div>
      </div>
    }
  `,
})
export class DemoBannerComponent {
  private readonly confirm = inject(ConfirmService);
  protected readonly isDemo = isDemo;

  protected async reset(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Clear demo data?',
      message: 'All accounts, forms and responses stored in this browser will be removed.',
      confirmLabel: 'Clear data',
      danger: true,
    });
    if (confirmed) {
      clearDemoData();
      window.location.assign(document.baseURI);
    }
  }
}
