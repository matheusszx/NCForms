import { DatePipe, I18nPluralPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { FormsApi } from '../../core/api/forms.api';
import { toApiError } from '../../core/api-error';
import { copyToClipboard, publicFormUrl } from '../../core/clipboard';
import { ConfirmService } from '../../core/confirm.service';
import { FormSummary } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, I18nPluralPipe, FormsModule, RouterLink, IconComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'openMenu.set(null)' },
  template: `
    <section class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-6xl px-4 py-8">
        <h2 class="text-sm font-medium text-slate-600">Start a new form</h2>
        <button
          type="button"
          class="group mt-3 flex h-40 w-36 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 text-brand-700 transition hover:border-brand-500 hover:bg-brand-100 disabled:opacity-60"
          (click)="create()"
          [disabled]="creating()"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm transition group-hover:scale-105">
            <app-icon name="plus" [size]="26" />
          </span>
          <span class="text-sm font-medium">{{ creating() ? 'Creating…' : 'Blank' }}</span>
        </button>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-lg font-semibold text-slate-900">My forms</h1>
        @if (forms().length > 0) {
          <input
            type="search"
            class="input max-w-xs"
            placeholder="Search forms"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            aria-label="Search forms"
          />
        }
      </div>

      @if (loading()) {
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="card h-36 animate-pulse bg-slate-100"></div>
          }
        </div>
      } @else if (loadError()) {
        <div class="card mt-6 p-8 text-center">
          <p class="text-sm text-slate-600">{{ loadError() }}</p>
          <button type="button" class="btn-secondary mt-4" (click)="load()">Try again</button>
        </div>
      } @else if (forms().length === 0) {
        <div class="card mt-6 flex flex-col items-center p-12 text-center">
          <span class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <app-icon name="file" [size]="28" />
          </span>
          <h2 class="mt-4 font-medium text-slate-900">No forms yet</h2>
          <p class="mt-1 max-w-sm text-sm text-slate-500">
            Create your first form, share the link and track responses here.
          </p>
          <button type="button" class="btn-primary mt-6" (click)="create()" [disabled]="creating()">
            <app-icon name="plus" [size]="18" /> New form
          </button>
        </div>
      } @else if (filtered().length === 0) {
        <p class="mt-6 text-sm text-slate-500">No forms match "{{ query() }}".</p>
      } @else {
        <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (form of filtered(); track form.id) {
            <li class="card group relative flex flex-col transition hover:border-brand-300 hover:shadow-md">
              <a
                [routerLink]="['/forms', form.id, 'results']"
                class="flex flex-1 flex-col gap-3 rounded-xl p-5 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <div class="flex items-start gap-3 pr-8">
                  <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <app-icon name="file" [size]="18" />
                  </span>
                  <h3 class="line-clamp-2 font-medium text-slate-900 group-hover:text-brand-800">{{ form.title }}</h3>
                </div>
                <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                  <app-status-badge [status]="form.status" />
                  <span class="flex items-center gap-1">
                    <app-icon name="inbox" [size]="14" />
                    {{ form.responseCount | i18nPlural: responsePlural }}
                  </span>
                </div>
                <p class="text-xs text-slate-400">Edited {{ form.updatedAt | date: 'MMM d, y, h:mm a' }}</p>
              </a>

              <div class="absolute right-2 top-2">
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Form actions"
                  [attr.aria-expanded]="openMenu() === form.id"
                  (click)="toggleMenu(form.id, $event)"
                >
                  <app-icon name="dots" [size]="18" />
                </button>
                @if (openMenu() === form.id) {
                  <div class="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg" role="menu">
                    <a role="menuitem" class="menu-item" [routerLink]="['/forms', form.id, 'edit']">
                      <app-icon name="pencil" [size]="16" /> Edit
                    </a>
                    <a role="menuitem" class="menu-item" [routerLink]="['/forms', form.id, 'results']">
                      <app-icon name="inbox" [size]="16" /> View responses
                    </a>
                    @if (form.status !== 'DRAFT') {
                      <button role="menuitem" type="button" class="menu-item" (click)="copyLink(form)">
                        <app-icon name="link" [size]="16" /> Copy link
                      </button>
                    }
                    @if (form.status === 'PUBLISHED') {
                      <button role="menuitem" type="button" class="menu-item" (click)="close(form)">
                        <app-icon name="pause" [size]="16" /> Stop accepting responses
                      </button>
                    } @else {
                      <button role="menuitem" type="button" class="menu-item" (click)="publish(form)">
                        <app-icon name="send" [size]="16" /> {{ form.status === 'DRAFT' ? 'Publish' : 'Reopen' }}
                      </button>
                    }
                    <div class="my-1 border-t border-slate-100"></div>
                    <button role="menuitem" type="button" class="menu-item text-red-600" (click)="remove(form)">
                      <app-icon name="trash" [size]="16" /> Delete
                    </button>
                  </div>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(FormsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly forms = signal<FormSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly openMenu = signal<string | null>(null);
  protected readonly query = signal('');

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.forms().filter((f) => f.title.toLowerCase().includes(q)) : this.forms();
  });

  protected readonly responsePlural = {
    '=0': 'No responses',
    '=1': '1 response',
    other: '# responses',
  };

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (forms) => {
        this.forms.set(forms);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected create(): void {
    this.creating.set(true);
    this.api.create().subscribe({
      next: (form) => void this.router.navigate(['/forms', form.id, 'edit']),
      error: (err) => {
        this.creating.set(false);
        this.toast.error(toApiError(err).message);
      },
    });
  }

  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((current) => (current === id ? null : id));
  }

  protected async copyLink(form: FormSummary): Promise<void> {
    const ok = await copyToClipboard(publicFormUrl(form.slug));
    if (ok) {
      this.toast.success('Link copied.');
    } else {
      this.toast.info(publicFormUrl(form.slug));
    }
  }

  protected publish(form: FormSummary): void {
    this.api.publish(form.id).subscribe({
      next: (updated) => {
        this.replace(form.id, { status: updated.status, updatedAt: updated.updatedAt });
        this.toast.success('Form published. It now accepts responses.');
      },
      error: (err) => this.toast.error(toApiError(err).message),
    });
  }

  protected close(form: FormSummary): void {
    this.api.close(form.id).subscribe({
      next: (updated) => {
        this.replace(form.id, { status: updated.status, updatedAt: updated.updatedAt });
        this.toast.success('The form is no longer accepting responses.');
      },
      error: (err) => this.toast.error(toApiError(err).message),
    });
  }

  protected async remove(form: FormSummary): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete form?',
      message: `"${form.title}" and all of its ${form.responseCount} responses will be permanently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.api.delete(form.id).subscribe({
      next: () => {
        this.forms.update((list) => list.filter((f) => f.id !== form.id));
        this.toast.success('Form deleted.');
      },
      error: (err) => this.toast.error(toApiError(err).message),
    });
  }

  private replace(id: string, patch: Partial<FormSummary>): void {
    this.forms.update((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
}
