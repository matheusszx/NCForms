import { DatePipe, I18nPluralPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FormsApi, ResponsesApi } from '../../core/api/forms.api';
import { toApiError } from '../../core/api-error';
import { copyToClipboard, publicFormUrl } from '../../core/clipboard';
import { ConfirmService } from '../../core/confirm.service';
import { fieldTypeInfo } from '../../core/field-types';
import { AnswerItem, FormDetail, Page, ResponseDetail, ResponseSummary } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-results-page',
  imports: [DatePipe, I18nPluralPipe, RouterLink, IconComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
        <a routerLink="/" class="icon-btn" title="Back" aria-label="Back to my forms">
          <app-icon name="arrow-left" [size]="18" />
        </a>
        <div class="min-w-0 flex-1">
          @if (form(); as f) {
            <h1 class="truncate text-lg font-semibold text-slate-900">{{ f.title }}</h1>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <app-status-badge [status]="f.status" />
              <span>{{ total() | i18nPlural: responsePlural }}</span>
            </div>
          } @else {
            <div class="h-6 w-48 animate-pulse rounded bg-slate-200"></div>
          }
        </div>
        @if (form(); as f) {
          @if (f.status !== 'DRAFT') {
            <button type="button" class="btn-secondary" (click)="copyLink(f)">
              <app-icon name="link" [size]="16" /> Copy link
            </button>
            <a class="btn-ghost" [href]="'/f/' + f.slug" target="_blank" rel="noopener">
              <app-icon name="external" [size]="16" /> Open
            </a>
          }
          <a class="btn-primary" [routerLink]="['/forms', f.id, 'edit']">
            <app-icon name="pencil" [size]="16" /> Edit form
          </a>
        }
      </div>
    </div>

    <div class="mx-auto max-w-6xl px-4 py-6">
      @if (loadError()) {
        <div class="card p-8 text-center">
          <p class="text-sm text-slate-600">{{ loadError() }}</p>
          <a routerLink="/" class="btn-secondary mt-4">Back</a>
        </div>
      } @else if (page(); as p) {
        @if (p.totalItems === 0) {
          <div class="card flex flex-col items-center p-12 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <app-icon name="inbox" [size]="28" />
            </span>
            <h2 class="mt-4 font-medium text-slate-900">No responses yet</h2>
            @if (form()?.status === 'PUBLISHED') {
              <p class="mt-1 max-w-sm text-sm text-slate-500">Share the form link to start receiving responses.</p>
              <button type="button" class="btn-primary mt-6" (click)="copyLink(form()!)">
                <app-icon name="link" [size]="16" /> Copy link
              </button>
            } @else if (form()?.status === 'DRAFT') {
              <p class="mt-1 max-w-sm text-sm text-slate-500">Publish the form so it can receive responses.</p>
              <a class="btn-primary mt-6" [routerLink]="['/forms', id(), 'edit']">Go to editor</a>
            } @else {
              <p class="mt-1 max-w-sm text-sm text-slate-500">This form is closed to new responses.</p>
            }
          </div>
        } @else {
          <div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
            <!-- List -->
            <aside class="card h-fit overflow-hidden">
              <h2 class="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">Responses</h2>
              <ul class="max-h-[60vh] overflow-y-auto">
                @for (item of p.items; track item.id) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-2 border-l-4 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50"
                      [class]="item.id === selectedId() ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-transparent text-slate-700'"
                      (click)="select(item.id)"
                    >
                      <span class="font-medium">#{{ item.number }}</span>
                      <span class="text-xs text-slate-500">{{ item.submittedAt | date: 'MMM d, y, h:mm a' }}</span>
                    </button>
                  </li>
                }
              </ul>
              @if (p.totalPages > 1) {
                <div class="flex items-center justify-between border-t border-slate-100 px-2 py-2 text-xs text-slate-500">
                  <button type="button" class="icon-btn h-8 w-8" [disabled]="p.page === 0" (click)="loadPage(p.page - 1)" aria-label="Previous page">
                    <app-icon name="chevron-left" [size]="16" />
                  </button>
                  Page {{ p.page + 1 }} of {{ p.totalPages }}
                  <button type="button" class="icon-btn h-8 w-8" [disabled]="p.page + 1 >= p.totalPages" (click)="loadPage(p.page + 1)" aria-label="Next page">
                    <app-icon name="chevron-right" [size]="16" />
                  </button>
                </div>
              }
            </aside>

            <!-- Individual response -->
            <section class="min-w-0">
              @if (detail(); as d) {
                <div class="card mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
                  <button type="button" class="icon-btn" [disabled]="!d.previousId || loadingDetail()" (click)="select(d.previousId!)"
                          title="Previous response" aria-label="Previous response">
                    <app-icon name="chevron-left" [size]="20" />
                  </button>
                  <p class="text-sm font-medium text-slate-800">Response {{ d.number }} of {{ d.total }}</p>
                  <button type="button" class="icon-btn" [disabled]="!d.nextId || loadingDetail()" (click)="select(d.nextId!)"
                          title="Next response" aria-label="Next response">
                    <app-icon name="chevron-right" [size]="20" />
                  </button>
                  <p class="flex-1 text-right text-xs text-slate-500">Submitted {{ d.submittedAt | date: "MMM d, y 'at' h:mm a" }}</p>
                  <button type="button" class="icon-btn hover:text-red-600" (click)="deleteResponse(d)" title="Delete response" aria-label="Delete response">
                    <app-icon name="trash" [size]="18" />
                  </button>
                </div>

                <div class="space-y-3" [class.opacity-60]="loadingDetail()">
                  @for (item of d.items; track item.fieldId) {
                    <article class="card p-5">
                      <div class="flex flex-wrap items-center gap-2">
                        <h3 class="font-medium text-slate-900">{{ item.label }}</h3>
                        @if (item.archived) {
                          <span class="badge bg-slate-100 text-slate-600" title="This question was removed or changed in the form">Question removed</span>
                        }
                      </div>
                      <p class="mt-0.5 text-xs text-slate-400">{{ typeLabel(item) }}</p>
                      <div class="mt-3">
                        @if (item.values.length === 0) {
                          <p class="text-sm italic text-slate-400">No answer</p>
                        } @else if (item.type === 'CHECKBOX') {
                          <ul class="flex flex-wrap gap-2">
                            @for (v of item.values; track $index) {
                              <li class="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">{{ v }}</li>
                            }
                          </ul>
                        } @else {
                          <p class="whitespace-pre-line break-words text-sm text-slate-800">{{ display(item) }}</p>
                        }
                      </div>
                    </article>
                  }
                </div>
              } @else {
                <div class="card h-64 animate-pulse bg-slate-100"></div>
              }
            </section>
          </div>
        }
      } @else {
        <div class="card h-64 animate-pulse bg-slate-100"></div>
      }
    </div>
  `,
})
export class ResultsPage implements OnInit {
  private readonly formsApi = inject(FormsApi);
  private readonly responsesApi = inject(ResponsesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** Route parameter and query param (?r=) bound via withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly r = input<string>();

  protected readonly responsePlural = { '=0': 'No responses', '=1': '1 response', other: '# responses' };

  protected readonly form = signal<FormDetail | null>(null);
  protected readonly page = signal<Page<ResponseSummary> | null>(null);
  protected readonly detail = signal<ResponseDetail | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly total = signal(0);

  ngOnInit(): void {
    this.formsApi.get(this.id()).subscribe({
      next: (form) => {
        this.form.set(form);
        this.total.set(form.responseCount);
      },
      error: (err) => this.loadError.set(toApiError(err).message),
    });
    this.loadPage(0, this.r());
  }

  protected loadPage(page: number, selectId?: string): void {
    this.responsesApi.list(this.id(), page, PAGE_SIZE).subscribe({
      next: (result) => {
        this.page.set(result);
        this.total.set(result.totalItems);
        const target = selectId ?? (this.selectedId() ? undefined : result.items[0]?.id);
        if (target) {
          this.select(target);
        } else if (result.totalItems === 0) {
          this.detail.set(null);
          this.selectedId.set(null);
        }
      },
      error: (err) => this.loadError.set(toApiError(err).message),
    });
  }

  protected select(responseId: string): void {
    this.selectedId.set(responseId);
    this.loadingDetail.set(true);
    void this.router.navigate([], { queryParams: { r: responseId }, replaceUrl: true });
    this.responsesApi.get(this.id(), responseId).subscribe({
      next: (detail) => {
        if (this.selectedId() === responseId) {
          this.detail.set(detail);
          this.loadingDetail.set(false);
        }
      },
      error: (err) => {
        this.loadingDetail.set(false);
        const apiError = toApiError(err);
        if (apiError.status === 404) {
          // Response doesn't exist (e.g. an old link): show the most recent one.
          const first = this.page()?.items[0]?.id;
          if (first && first !== responseId) {
            this.select(first);
            return;
          }
        }
        this.toast.error(apiError.message);
      },
    });
  }

  protected async deleteResponse(detail: ResponseDetail): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete response?',
      message: `Response #${detail.number} will be permanently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.responsesApi.delete(this.id(), detail.id).subscribe({
      next: () => {
        this.toast.success('Response deleted.');
        const neighbor = detail.previousId ?? detail.nextId ?? undefined;
        this.selectedId.set(null);
        this.detail.set(null);
        const currentPage = this.page()?.page ?? 0;
        const pageToLoad = this.page()?.items.length === 1 && currentPage > 0 ? currentPage - 1 : currentPage;
        this.loadPage(pageToLoad, neighbor);
      },
      error: (err) => this.toast.error(toApiError(err).message),
    });
  }

  protected async copyLink(form: FormDetail): Promise<void> {
    const url = publicFormUrl(form.slug);
    if (await copyToClipboard(url)) {
      this.toast.success('Link copied.');
    } else {
      this.toast.info(url);
    }
  }

  protected typeLabel(item: AnswerItem): string {
    return fieldTypeInfo(item.type).label;
  }

  protected display(item: AnswerItem): string {
    const value = item.values.join(', ');
    if (item.type === 'DATE') {
      const [y, m, d] = value.split('-');
      return d && m && y ? `${m}/${d}/${y}` : value;
    }
    return value;
  }
}
