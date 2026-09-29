import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { RenderField, scaleRange, textMaxLength } from './form-controls';

/** Controle de entrada de uma pergunta, conforme o tipo do campo. */
@Component({
  selector: 'app-field-input',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @let f = field();
    @let ctrl = control();
    @switch (f.type) {
      @case ('SHORT_TEXT') {
        <input
          type="text"
          class="input-underline max-w-md"
          [id]="inputId()"
          [formControl]="ctrl"
          [placeholder]="f.config.placeholder ?? 'Sua resposta'"
          [attr.maxlength]="maxLength()"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
      }
      @case ('LONG_TEXT') {
        <textarea
          rows="3"
          class="input-underline resize-y"
          [id]="inputId()"
          [formControl]="ctrl"
          [placeholder]="f.config.placeholder ?? 'Sua resposta'"
          [attr.maxlength]="maxLength()"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        ></textarea>
      }
      @case ('EMAIL') {
        <input
          type="email"
          class="input-underline max-w-md"
          autocomplete="email"
          [id]="inputId()"
          [formControl]="ctrl"
          [placeholder]="f.config.placeholder ?? 'nome@exemplo.com'"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
      }
      @case ('NUMBER') {
        <input
          type="number"
          step="any"
          class="input-underline max-w-xs"
          [id]="inputId()"
          [formControl]="ctrl"
          [placeholder]="f.config.placeholder ?? 'Sua resposta'"
          [attr.min]="f.config.min ?? null"
          [attr.max]="f.config.max ?? null"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
      }
      @case ('DATE') {
        <input
          type="date"
          class="input max-w-xs"
          [id]="inputId()"
          [formControl]="ctrl"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
      }
      @case ('RADIO') {
        <div class="space-y-1" role="radiogroup" [attr.aria-labelledby]="labelId()" [attr.aria-describedby]="describedBy()">
          @for (option of f.options; track $index) {
            <label class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
              <input type="radio" class="h-4 w-4 accent-brand-600" [name]="f.key" [value]="option.id" [formControl]="ctrl" />
              <span class="text-sm text-slate-800">{{ option.label }}</span>
            </label>
          }
        </div>
      }
      @case ('CHECKBOX') {
        <div class="space-y-1" role="group" [attr.aria-labelledby]="labelId()" [attr.aria-describedby]="describedBy()">
          @for (option of f.options; track $index) {
            <label class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
              <input
                type="checkbox"
                class="h-4 w-4 rounded accent-brand-600"
                [checked]="isChecked(option.id)"
                [disabled]="ctrl.disabled"
                (change)="toggle(option.id, $event)"
              />
              <span class="text-sm text-slate-800">{{ option.label }}</span>
            </label>
          }
        </div>
      }
      @case ('DROPDOWN') {
        <select
          class="input max-w-sm"
          [id]="inputId()"
          [formControl]="ctrl"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        >
          <option [ngValue]="null">Escolher</option>
          @for (option of f.options; track $index) {
            <option [ngValue]="option.id">{{ option.label }}</option>
          }
        </select>
      }
      @case ('LINEAR_SCALE') {
        <div
          class="flex flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-4"
          role="radiogroup"
          [attr.aria-labelledby]="labelId()"
          [attr.aria-describedby]="describedBy()"
        >
          @if (f.config.minLabel) {
            <span class="w-full pb-2 text-sm text-slate-600 sm:w-auto">{{ f.config.minLabel }}</span>
          }
          @for (n of scale(); track n) {
            <label class="flex cursor-pointer flex-col items-center gap-1.5">
              <span class="text-sm text-slate-700">{{ n }}</span>
              <input type="radio" class="h-5 w-5 accent-brand-600" [name]="f.key" [value]="n" [formControl]="ctrl" />
            </label>
          }
          @if (f.config.maxLabel) {
            <span class="w-full pb-2 text-sm text-slate-600 sm:w-auto">{{ f.config.maxLabel }}</span>
          }
        </div>
      }
    }
  `,
})
export class FieldInputComponent {
  readonly field = input.required<RenderField>();
  readonly control = input.required<FormControl>();
  readonly invalid = input(false);

  protected readonly inputId = computed(() => `q-${this.field().key}`);
  protected readonly labelId = computed(() => `q-${this.field().key}-label`);
  protected readonly describedBy = computed(() => `q-${this.field().key}-help q-${this.field().key}-error`);
  protected readonly maxLength = computed(() => textMaxLength(this.field()));
  protected readonly scale = computed(() => scaleRange(this.field()));

  protected isChecked(optionId: string | null): boolean {
    const value = this.control().value;
    return Array.isArray(value) && value.includes(optionId);
  }

  protected toggle(optionId: string | null, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const control = this.control();
    const current: (string | null)[] = Array.isArray(control.value) ? control.value : [];
    const next = checked ? [...current.filter((id) => id !== optionId), optionId] : current.filter((id) => id !== optionId);
    control.setValue(next);
    control.markAsDirty();
    control.markAsTouched();
  }
}
