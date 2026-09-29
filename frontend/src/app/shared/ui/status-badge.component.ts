import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { STATUS_INFO } from '../../core/field-types';
import { FormStatus } from '../../core/models';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="info().classes">{{ info().label }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<FormStatus>();
  protected readonly info = computed(() => STATUS_INFO[this.status()]);
}
