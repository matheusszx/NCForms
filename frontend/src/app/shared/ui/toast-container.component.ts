import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toast-container',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg"
          [class.bg-slate-900]="toast.kind === 'info'"
          [class.bg-emerald-700]="toast.kind === 'success'"
          [class.bg-red-700]="toast.kind === 'error'"
          role="status"
        >
          <app-icon [name]="toast.kind === 'error' ? 'alert' : toast.kind === 'success' ? 'check-circle' : 'info'" [size]="18" />
          <span class="flex-1">{{ toast.message }}</span>
          <button type="button" class="opacity-70 hover:opacity-100" (click)="toasts.dismiss(toast.id)" aria-label="Fechar">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
}
