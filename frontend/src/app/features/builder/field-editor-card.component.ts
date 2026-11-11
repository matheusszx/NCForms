import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FIELD_TYPES, fieldTypeInfo } from '../../core/field-types';
import { FieldConfig, FieldOption, FieldType } from '../../core/models';
import { IconComponent } from '../../shared/ui/icon.component';
import { EditorField } from './builder-ops';

/** Editor card for one field. Shows a summary when inactive and the full editor when selected. */
@Component({
  selector: 'app-field-editor-card',
  imports: [FormsModule, NgTemplateOutlet, IconComponent, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div
      class="card relative overflow-hidden transition"
      [class.ring-2]="active()"
      [class.ring-brand-200]="active()"
      [class.border-red-300]="hasErrors()"
      (click)="activate.emit()"
    >
      @if (active()) {
        <div class="absolute inset-y-0 left-0 w-1.5 bg-brand-600"></div>
      }
      <div
        cdkDragHandle
        class="flex cursor-grab justify-center pt-1.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        title="Drag to reorder"
      >
        <app-icon name="grip" [size]="18" class="rotate-90" />
      </div>

      @if (!active()) {
        <!-- Summary -->
        <div class="flex items-start gap-3 px-6 pb-5 pt-1">
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-900" [class.text-lg]="f.type === 'SECTION_TITLE'">
              {{ f.label || '(no text)' }}
              @if (f.required) { <span class="text-red-600">*</span> }
            </p>
            @if (f.helpText) {
              <p class="mt-0.5 truncate text-sm text-slate-500">{{ f.helpText }}</p>
            }
            @if (typeInfo().hasOptions) {
              <p class="mt-2 truncate text-sm text-slate-500">{{ optionSummary() }}</p>
            }
          </div>
          <span class="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            <app-icon [name]="typeInfo().icon" [size]="14" /> {{ typeInfo().label }}
          </span>
        </div>
        @if (hasErrors()) {
          <p class="field-error px-6 pb-4"><app-icon name="alert" [size]="16" /> This field needs attention.</p>
        }
      } @else {
        <!-- Editor -->
        <div class="space-y-4 px-6 pb-4 pt-1">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div class="flex-1">
              <input
                class="input bg-slate-50 text-base font-medium"
                [class.input-invalid]="errors()['label']"
                [ngModel]="f.label"
                (ngModelChange)="patch.emit({ label: $event })"
                (focus)="selectDefault($event)"
                [placeholder]="f.type === 'SECTION_TITLE' ? 'Section title' : 'Question'"
                [attr.aria-label]="f.type === 'SECTION_TITLE' ? 'Section title' : 'Question text'"
                data-autofocus
              />
              @if (errors()['label']; as msg) { <p class="field-error">{{ msg }}</p> }
            </div>
            <select
              class="input sm:w-56"
              [ngModel]="f.type"
              (ngModelChange)="changeType.emit($event)"
              aria-label="Field type"
            >
              @for (t of fieldTypes; track t.type) {
                <option [value]="t.type">{{ t.label }}</option>
              }
            </select>
          </div>

          <input
            class="input-underline text-sm"
            [ngModel]="f.helpText ?? ''"
            (ngModelChange)="patch.emit({ helpText: $event || null })"
            [placeholder]="f.type === 'SECTION_TITLE' ? 'Section description (optional)' : 'Description / instructions (optional)'"
            aria-label="Description"
          />

          @switch (f.type) {
            @case ('SHORT_TEXT') { <ng-container *ngTemplateOutlet="textConfig" /> }
            @case ('LONG_TEXT') { <ng-container *ngTemplateOutlet="textConfig" /> }
            @case ('EMAIL') {
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-sm">
                  <span class="label">Placeholder text</span>
                  <input class="input" [ngModel]="f.config.placeholder ?? ''" (ngModelChange)="setConfig('placeholder', $event)" placeholder="name@example.com" />
                </label>
              </div>
            }
            @case ('NUMBER') {
              <div class="grid gap-3 sm:grid-cols-3">
                <label class="text-sm">
                  <span class="label">Placeholder text</span>
                  <input class="input" [ngModel]="f.config.placeholder ?? ''" (ngModelChange)="setConfig('placeholder', $event)" />
                </label>
                <label class="text-sm">
                  <span class="label">Minimum value</span>
                  <input type="number" class="input" [ngModel]="f.config.min ?? null" (ngModelChange)="setConfig('min', $event)" />
                </label>
                <label class="text-sm">
                  <span class="label">Maximum value</span>
                  <input type="number" class="input" [ngModel]="f.config.max ?? null" (ngModelChange)="setConfig('max', $event)" />
                </label>
              </div>
            }
            @case ('DATE') {
              <div class="flex items-center gap-2 text-sm text-slate-500">
                <app-icon name="calendar" [size]="16" /> The respondent will pick a date.
              </div>
            }
            @case ('LINEAR_SCALE') {
              <div class="space-y-3">
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <select class="input w-20" [ngModel]="f.config.min ?? 1" (ngModelChange)="setConfig('min', +$event)" aria-label="Scale start">
                    <option [ngValue]="0">0</option>
                    <option [ngValue]="1">1</option>
                  </select>
                  <span class="text-slate-500">to</span>
                  <select class="input w-20" [ngModel]="f.config.max ?? 5" (ngModelChange)="setConfig('max', +$event)" aria-label="Scale end">
                    @for (n of scaleMaxValues; track n) {
                      <option [ngValue]="n">{{ n }}</option>
                    }
                  </select>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="text-sm">
                    <span class="label">Label for {{ f.config.min ?? 1 }} (optional)</span>
                    <input class="input" [ngModel]="f.config.minLabel ?? ''" (ngModelChange)="setConfig('minLabel', $event)" placeholder="e.g. Disagree" />
                  </label>
                  <label class="text-sm">
                    <span class="label">Label for {{ f.config.max ?? 5 }} (optional)</span>
                    <input class="input" [ngModel]="f.config.maxLabel ?? ''" (ngModelChange)="setConfig('maxLabel', $event)" placeholder="e.g. Agree" />
                  </label>
                </div>
              </div>
            }
          }

          @if (typeInfo().hasOptions) {
            <div>
              <ul class="space-y-1">
                @for (option of f.options; track $index; let i = $index) {
                  <li class="flex items-center gap-3">
                    @switch (f.type) {
                      @case ('RADIO') { <span class="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300"></span> }
                      @case ('CHECKBOX') { <span class="h-4 w-4 shrink-0 rounded border-2 border-slate-300"></span> }
                      @default { <span class="w-4 shrink-0 text-right text-sm text-slate-400">{{ i + 1 }}.</span> }
                    }
                    <input
                      class="input-underline flex-1 text-sm"
                      [ngModel]="option.label"
                      (ngModelChange)="updateOption(i, $event)"
                      (keydown.enter)="$event.preventDefault(); addOption(i)"
                      [attr.aria-label]="'Option ' + (i + 1)"
                      [attr.data-option-index]="i"
                    />
                    <button
                      type="button"
                      class="icon-btn h-8 w-8"
                      (click)="removeOption(i)"
                      [disabled]="f.options.length === 1"
                      title="Remove option"
                      aria-label="Remove option"
                    >
                      <app-icon name="x" [size]="16" />
                    </button>
                  </li>
                }
              </ul>
              <button type="button" class="btn-ghost mt-1 px-2 text-sm text-brand-700" (click)="addOption(f.options.length - 1)">
                <app-icon name="plus" [size]="16" /> Add option
              </button>
              @if (errors()['options']; as msg) { <p class="field-error">{{ msg }}</p> }

              @if (f.type === 'CHECKBOX') {
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <label class="text-sm">
                    <span class="label">Minimum selections (optional)</span>
                    <input type="number" min="0" class="input" [ngModel]="f.config.minSelected ?? null" (ngModelChange)="setConfig('minSelected', $event)" />
                  </label>
                  <label class="text-sm">
                    <span class="label">Maximum selections (optional)</span>
                    <input type="number" min="1" class="input" [ngModel]="f.config.maxSelected ?? null" (ngModelChange)="setConfig('maxSelected', $event)" />
                  </label>
                </div>
              }
            </div>
          }

          @if (errors()['config']; as msg) { <p class="field-error">{{ msg }}</p> }
          @if (errors()['type']; as msg) { <p class="field-error">{{ msg }}</p> }
        </div>

        <!-- Action footer -->
        <div class="flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 px-4 py-2">
          <button type="button" class="icon-btn" (click)="move.emit(-1)" [disabled]="index() === 0" title="Move up" aria-label="Move up">
            <app-icon name="chevron-up" [size]="18" />
          </button>
          <button type="button" class="icon-btn" (click)="move.emit(1)" [disabled]="index() === total() - 1" title="Move down" aria-label="Move down">
            <app-icon name="chevron-down" [size]="18" />
          </button>
          <button type="button" class="icon-btn" (click)="duplicate.emit()" title="Duplicate" aria-label="Duplicate">
            <app-icon name="copy" [size]="18" />
          </button>
          <button type="button" class="icon-btn hover:text-red-600" (click)="remove.emit()" title="Delete" aria-label="Delete">
            <app-icon name="trash" [size]="18" />
          </button>
          @if (typeInfo().isInput) {
            <div class="mx-2 h-6 w-px bg-slate-200"></div>
            <button
              type="button"
              role="switch"
              class="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
              [attr.aria-checked]="f.required"
              (click)="patch.emit({ required: !f.required })"
            >
              Required
              <span class="relative inline-flex h-5 w-9 items-center rounded-full transition" [class.bg-brand-600]="f.required" [class.bg-slate-300]="!f.required">
                <span class="inline-block h-4 w-4 rounded-full bg-white shadow transition" [class.translate-x-4.5]="f.required" [class.translate-x-0.5]="!f.required"></span>
              </span>
            </button>
          }
        </div>
      }
    </div>

    <ng-template #textConfig>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm">
          <span class="label">Placeholder text</span>
          <input class="input" [ngModel]="field().config.placeholder ?? ''" (ngModelChange)="setConfig('placeholder', $event)" placeholder="Your answer" />
        </label>
        <label class="text-sm">
          <span class="label">Character limit (optional)</span>
          <input type="number" min="1" class="input" [ngModel]="field().config.maxLength ?? null" (ngModelChange)="setConfig('maxLength', $event)" />
        </label>
      </div>
    </ng-template>
  `,
})
export class FieldEditorCardComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly field = input.required<EditorField>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly active = input(false);
  /** Server errors for this field, by attribute (label, options, config). */
  readonly errors = input<Record<string, string>>({});

  readonly activate = output<void>();
  readonly patch = output<Partial<EditorField>>();
  readonly changeType = output<FieldType>();
  readonly duplicate = output<void>();
  readonly remove = output<void>();
  readonly move = output<number>();

  protected readonly fieldTypes = FIELD_TYPES;
  protected readonly scaleMaxValues = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  protected readonly typeInfo = computed(() => fieldTypeInfo(this.field().type));
  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly optionSummary = computed(() =>
    this.field()
      .options.map((o) => o.label)
      .join(' · '),
  );

  protected setConfig(key: keyof FieldConfig, value: unknown): void {
    const config: FieldConfig = { ...this.field().config };
    if (value === null || value === undefined || value === '') {
      delete config[key];
    } else {
      (config as Record<string, unknown>)[key] = value;
    }
    this.patch.emit({ config });
  }

  protected updateOption(index: number, label: string): void {
    const options = this.field().options.map((o, i) => (i === index ? { ...o, label } : o));
    this.patch.emit({ options });
  }

  protected addOption(afterIndex: number): void {
    const options: FieldOption[] = [...this.field().options];
    options.splice(afterIndex + 1, 0, { id: null, label: `Option ${options.length + 1}` });
    this.patch.emit({ options });
    this.focusOption(afterIndex + 1);
  }

  protected removeOption(index: number): void {
    this.patch.emit({ options: this.field().options.filter((_, i) => i !== index) });
  }

  /** When a default text is focused, select it so it is easy to replace. */
  protected selectDefault(event: FocusEvent): void {
    const target = event.target as HTMLInputElement;
    if (target.value === 'Untitled question' || target.value === 'New section') {
      target.select();
    }
  }

  private focusOption(index: number): void {
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        `[data-option-index="${index}"]`,
      );
      el?.focus();
      el?.select();
    });
  }
}
