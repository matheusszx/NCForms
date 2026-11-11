import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { I18nPluralPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

import { FormsApi } from '../../core/api/forms.api';
import { toApiError } from '../../core/api-error';
import { copyToClipboard, publicFormUrl } from '../../core/clipboard';
import { FIELD_TYPES } from '../../core/field-types';
import { AnswerValue, FieldType, FormDetail, FormStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { HasUnsavedChanges } from '../../core/unsaved-changes.guard';
import { FormRendererComponent } from '../../shared/form-renderer/form-renderer.component';
import { RenderField } from '../../shared/form-renderer/form-controls';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import {
  EditorField,
  changeFieldType,
  createField,
  duplicateField,
  errorsByFieldIndex,
  insertField,
  moveField,
  patchField,
  removeField,
  toEditorFields,
  toRequestFields,
} from './builder-ops';
import { FieldEditorCardComponent } from './field-editor-card.component';

type Mode = 'edit' | 'preview';

@Component({
  selector: 'app-builder-page',
  imports: [
    FormsModule,
    RouterLink,
    I18nPluralPipe,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    IconComponent,
    StatusBadgeComponent,
    FieldEditorCardComponent,
    FormRendererComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(document:click)': 'addMenuOpen.set(false)',
  },
  template: `
    <!-- Toolbar -->
    <div class="sticky top-14 z-20 border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
        <a routerLink="/" class="icon-btn" title="Back" aria-label="Back to my forms">
          <app-icon name="arrow-left" [size]="18" />
        </a>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900">{{ title() || 'Untitled form' }}</p>
          <p class="text-xs text-slate-500">
            @if (saving()) { Saving… } @else if (dirty()) { Unsaved changes } @else if (loaded()) { All changes saved }
          </p>
        </div>

        @if (status(); as s) {
          <app-status-badge [status]="s" class="hidden sm:inline-flex" />
        }

        <div class="flex rounded-lg bg-slate-100 p-0.5 text-sm" role="tablist">
          <button type="button" role="tab" class="rounded-md px-3 py-1.5 transition" [attr.aria-selected]="mode() === 'edit'"
                  [class]="mode() === 'edit' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'"
                  (click)="mode.set('edit')">
            Edit
          </button>
          <button type="button" role="tab" class="flex items-center gap-1 rounded-md px-3 py-1.5 transition" [attr.aria-selected]="mode() === 'preview'"
                  [class]="mode() === 'preview' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'"
                  (click)="mode.set('preview')">
            <app-icon name="eye" [size]="16" /> Preview
          </button>
        </div>

        @if (formId(); as id) {
          <a [routerLink]="['/forms', id, 'results']" class="btn-ghost hidden md:inline-flex">
            <app-icon name="inbox" [size]="16" /> {{ responseCount() | i18nPlural: responsePlural }}
          </a>
        }
        @if (status() === 'PUBLISHED') {
          <button type="button" class="btn-secondary" (click)="copyLink()" title="Copy public link">
            <app-icon name="link" [size]="16" /> <span class="hidden sm:inline">Copy link</span>
          </button>
        }
        <button type="button" class="btn-secondary" (click)="save()" [disabled]="saving() || !loaded()">
          <app-icon name="save" [size]="16" /> Save
        </button>
        @if (status() === 'PUBLISHED') {
          <button type="button" class="btn-secondary" (click)="closeForm()" [disabled]="saving()">
            <app-icon name="pause" [size]="16" /> <span class="hidden sm:inline">Close</span>
          </button>
        } @else {
          <button type="button" class="btn-primary" (click)="publish()" [disabled]="saving() || !loaded()">
            <app-icon name="send" [size]="16" /> {{ status() === 'CLOSED' ? 'Reopen' : 'Publish' }}
          </button>
        }
      </div>
    </div>

    <div class="mx-auto max-w-3xl px-4 py-6 pb-32">
      @if (loadError()) {
        <div class="card p-8 text-center">
          <p class="text-sm text-slate-600">{{ loadError() }}</p>
          <a routerLink="/" class="btn-secondary mt-4">Back</a>
        </div>
      } @else if (!loaded()) {
        <div class="card h-40 animate-pulse bg-slate-100"></div>
      } @else if (mode() === 'preview') {
        <div class="mb-4 flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-800">
          <app-icon name="eye" [size]="16" /> Preview — this is how respondents will see the form.
        </div>
        <app-form-renderer
          [title]="title() || 'Untitled form'"
          [description]="description() || null"
          [fields]="previewFields()"
          (submitted)="onPreviewSubmit($event)"
        />
      } @else {
        @if (responseCount() > 0) {
          <div class="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <app-icon name="info" [size]="18" />
            <span>
              This form already has {{ responseCount() | i18nPlural: responsePlural }}. Questions that are deleted or change
              type are archived and remain visible in older responses.
            </span>
          </div>
        }

        <!-- Form header -->
        <section class="card overflow-hidden" (click)="activeIndex.set(-1)">
          <div class="h-2.5 bg-brand-600"></div>
          <div class="space-y-3 p-6">
            <input
              class="input-underline text-2xl font-semibold"
              [class.border-red-400]="titleError()"
              [ngModel]="title()"
              (ngModelChange)="title.set($event); markDirty()"
              placeholder="Form title"
              aria-label="Form title"
              maxlength="200"
            />
            @if (titleError(); as msg) { <p class="field-error">{{ msg }}</p> }
            <textarea
              rows="2"
              class="input-underline resize-y text-sm"
              [ngModel]="description()"
              (ngModelChange)="description.set($event); markDirty()"
              placeholder="Form description (optional)"
              aria-label="Form description"
            ></textarea>
          </div>
        </section>

        <!-- Fields -->
        <div
          cdkDropList
          cdkDropListLockAxis="y"
          (cdkDropListDropped)="drop($event)"
          class="mt-4 space-y-4"
        >
          @for (field of fields(); track field.key; let i = $index) {
            <div cdkDrag [attr.data-field-index]="i">
              <div *cdkDragPlaceholder class="h-24 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50"></div>
              <app-field-editor-card
                [field]="field"
                [index]="i"
                [total]="fields().length"
                [active]="activeIndex() === i"
                [errors]="fieldErrors().get(i) ?? {}"
                (activate)="activeIndex.set(i)"
                (patch)="onPatch(i, $event)"
                (changeType)="onChangeType(i, $event)"
                (duplicate)="onDuplicate(i)"
                (remove)="onRemove(i)"
                (move)="onMove(i, $event)"
              />
            </div>
          } @empty {
            <div class="card flex flex-col items-center p-10 text-center text-sm text-slate-500">
              <app-icon name="file" [size]="28" class="text-slate-300" />
              <p class="mt-3">Your form doesn't have any questions yet.</p>
              <p>Use the button below to add the first one.</p>
            </div>
          }
        </div>

        <!-- Add field -->
        <div class="relative mt-4 flex justify-center">
          <button type="button" class="btn-primary rounded-full px-5 shadow-md" (click)="toggleAddMenu($event)" [attr.aria-expanded]="addMenuOpen()">
            <app-icon name="plus" [size]="18" /> Add question
          </button>
          @if (addMenuOpen()) {
            <div class="absolute bottom-full z-30 mb-2 grid w-full max-w-lg grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl sm:grid-cols-3"
                 role="menu" (click)="$event.stopPropagation()">
              @for (t of fieldTypes; track t.type) {
                <button type="button" role="menuitem" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                        (click)="addField(t.type)">
                  <app-icon [name]="t.icon" [size]="18" class="text-brand-600" /> {{ t.label }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class BuilderPage implements OnInit, HasUnsavedChanges {
  private readonly api = inject(FormsApi);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly fieldTypes = FIELD_TYPES;
  protected readonly responsePlural = { '=0': 'No responses', '=1': '1 response', other: '# responses' };

  protected readonly loaded = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formId = signal<string | null>(null);
  protected readonly slug = signal('');
  protected readonly status = signal<FormStatus | null>(null);
  protected readonly responseCount = signal(0);

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly fields = signal<EditorField[]>([]);
  protected readonly activeIndex = signal(-1);

  protected readonly mode = signal<Mode>('edit');
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly addMenuOpen = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});

  protected readonly fieldErrors = computed(() => errorsByFieldIndex(this.serverErrors()));
  protected readonly titleError = computed(() => this.serverErrors()['title'] ?? null);

  /** Fields for the preview; unsaved items get temporary ids. */
  protected readonly previewFields = computed<RenderField[]>(() =>
    this.fields().map((f) => ({
      ...f,
      key: f.id ?? f.key,
      options: f.options.map((o, i) => ({ ...o, id: o.id ?? `${f.key}-o${i}` })),
    })),
  );

  ngOnInit(): void {
    this.api.get(this.id()).subscribe({
      next: (form) => {
        this.applyForm(form);
        this.activeIndex.set(form.fields.length === 0 ? -1 : 0);
        this.loaded.set(true);
      },
      error: (err) => this.loadError.set(toApiError(err).message),
    });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
    }
  }

  protected markDirty(): void {
    this.dirty.set(true);
  }

  // ---- field editing ----

  protected toggleAddMenu(event: Event): void {
    event.stopPropagation();
    this.addMenuOpen.update((open) => !open);
  }

  protected addField(type: FieldType): void {
    const { fields, index } = insertField(this.fields(), createField(type), this.activeIndex());
    this.updateStructure(fields, index);
    this.addMenuOpen.set(false);
    this.scrollToField(index, true);
  }

  protected onPatch(index: number, patch: Partial<EditorField>): void {
    this.fields.update((list) => patchField(list, index, patch));
    this.clearFieldErrors(index);
    this.dirty.set(true);
  }

  protected onChangeType(index: number, type: FieldType): void {
    this.fields.update((list) => list.map((f, i) => (i === index ? changeFieldType(f, type) : f)));
    this.clearFieldErrors(index);
    this.dirty.set(true);
  }

  protected onDuplicate(index: number): void {
    const { fields, index: newIndex } = duplicateField(this.fields(), index);
    this.updateStructure(fields, newIndex);
    this.scrollToField(newIndex, false);
  }

  protected onRemove(index: number): void {
    const fields = removeField(this.fields(), index);
    this.updateStructure(fields, Math.min(index, fields.length - 1));
  }

  protected onMove(index: number, delta: number): void {
    const target = index + delta;
    this.updateStructure(moveField(this.fields(), index, target), Math.max(0, Math.min(this.fields().length - 1, target)));
    this.scrollToField(this.activeIndex(), false);
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    this.updateStructure(moveField(this.fields(), event.previousIndex, event.currentIndex), event.currentIndex);
  }

  // ---- actions ----

  protected save(): void {
    this.persist().subscribe({
      next: () => this.toast.success('Changes saved.'),
      error: () => undefined, // already shown by persist()
    });
  }

  /** Saves pending changes and publishes (or reopens) the form. */
  protected publish(): void {
    this.persist()
      .pipe(
        switchMap((id) =>
          this.api.publish(id).pipe(
            catchError((err: unknown) => {
              this.toast.error(toApiError(err).message);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe({
        next: (form) => {
          this.status.set(form.status);
          this.toast.success('Form published! Copy the link to share it.');
        },
        error: () => undefined, // already shown by persist()
      });
  }

  protected closeForm(): void {
    const id = this.formId();
    if (!id) {
      return;
    }
    this.api.close(id).subscribe({
      next: (form) => {
        this.status.set(form.status);
        this.toast.success('The form is no longer accepting responses.');
      },
      error: (err) => this.toast.error(toApiError(err).message),
    });
  }

  protected async copyLink(): Promise<void> {
    const url = publicFormUrl(this.slug());
    if (await copyToClipboard(url)) {
      this.toast.success('Link copied.');
    } else {
      this.toast.info(url);
    }
  }

  protected onPreviewSubmit(_answers: Record<string, AnswerValue>): void {
    this.toast.info('Preview: responses are not submitted.');
  }

  /** Saves if there are changes and emits the form id. */
  private persist(): Observable<string> {
    const id = this.formId();
    if (!id) {
      return EMPTY;
    }
    if (!this.dirty()) {
      return of(id);
    }
    if (!this.title().trim()) {
      const message = 'Enter a form title.';
      this.serverErrors.set({ title: message });
      this.mode.set('edit');
      this.toast.error(message);
      return throwError(() => new Error(message));
    }
    this.saving.set(true);
    return this.api
      .update(id, {
        title: this.title().trim(),
        description: this.description().trim() || null,
        fields: toRequestFields(this.fields()),
      })
      .pipe(
        map((form) => {
          const active = this.activeIndex();
          this.applyForm(form);
          this.activeIndex.set(Math.min(active, form.fields.length - 1));
          this.saving.set(false);
          return form.id;
        }),
        catchError((err: unknown) => {
          this.saving.set(false);
          this.handleSaveError(err);
          return throwError(() => err);
        }),
      );
  }

  private handleSaveError(err: unknown): void {
    const apiError = toApiError(err);
    this.serverErrors.set(apiError.fieldErrors);
    this.toast.error(apiError.message);
    const firstErrored = [...errorsByFieldIndex(apiError.fieldErrors).keys()].sort((a, b) => a - b)[0];
    if (firstErrored !== undefined) {
      this.mode.set('edit');
      this.activeIndex.set(firstErrored);
      this.scrollToField(firstErrored, false);
    }
  }

  private applyForm(form: FormDetail): void {
    this.formId.set(form.id);
    this.slug.set(form.slug);
    this.status.set(form.status);
    this.responseCount.set(form.responseCount);
    this.title.set(form.title);
    this.description.set(form.description ?? '');
    this.fields.set(toEditorFields(form.fields));
    this.serverErrors.set({});
    this.dirty.set(false);
  }

  /** Structural changes (insert, remove, move) invalidate the server error indexes. */
  private updateStructure(fields: EditorField[], activeIndex: number): void {
    this.fields.set(fields);
    this.activeIndex.set(activeIndex);
    this.serverErrors.update((errors): Record<string, string> =>
      errors['title'] ? { title: errors['title'] } : {},
    );
    this.dirty.set(true);
  }

  private clearFieldErrors(index: number): void {
    const prefixes = [`fields.${index}.`, `fields[${index}].`];
    this.serverErrors.update((errors) => {
      const next = { ...errors };
      for (const key of Object.keys(next)) {
        if (prefixes.some((p) => key.startsWith(p))) {
          delete next[key];
        }
      }
      return next;
    });
  }

  private scrollToField(index: number, focus: boolean): void {
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-field-index="${index}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focus) {
        el?.querySelector<HTMLInputElement>('[data-autofocus]')?.focus();
      }
    });
  }
}
