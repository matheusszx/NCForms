import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmService } from '../../core/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (confirm.pending(); as dialog) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" (click)="confirm.answer(false)">
        <div
          class="card w-full max-w-md p-6"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="dialog.title"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-semibold text-slate-900">{{ dialog.title }}</h2>
          <p class="mt-2 text-sm text-slate-600">{{ dialog.message }}</p>
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="btn-secondary" (click)="confirm.answer(false)">Cancel</button>
            <button
              type="button"
              [class]="dialog.danger ? 'btn-danger' : 'btn-primary'"
              (click)="confirm.answer(true)"
              autofocus
            >
              {{ dialog.confirmLabel ?? 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);

  protected onEscape(): void {
    if (this.confirm.pending()) {
      this.confirm.answer(false);
    }
  }
}
