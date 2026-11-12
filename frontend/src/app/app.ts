import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfirmDialogComponent } from './shared/ui/confirm-dialog.component';
import { DemoBannerComponent } from './shared/ui/demo-banner.component';
import { ToastContainerComponent } from './shared/ui/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmDialogComponent, DemoBannerComponent],
  template: `
    <app-demo-banner />
    <router-outlet />
    <app-toast-container />
    <app-confirm-dialog />
  `,
})
export class App {}
