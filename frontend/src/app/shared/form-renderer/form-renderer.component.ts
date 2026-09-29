import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { AnswerValue } from '../../core/models';
import { IconComponent } from '../ui/icon.component';
import { FieldInputComponent } from './field-input.component';
import { RenderField, buildFormGroup, collectAnswers, errorMessage, isInputField } from './form-controls';

/**
 * Renderiza um formulário para ser respondido. Usado pelo formulário público e pela
 * pré-visualização do editor, garantindo que ambos exibam exatamente o mesmo resultado.
 */
@Component({
  selector: 'app-form-renderer',
  imports: [ReactiveFormsModule, FieldInputComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <form [formGroup]="form()" (ngSubmit)="submit()" class="space-y-4" novalidate>
      <section class="card overflow-hidden">
        <div class="h-2.5 bg-brand-600"></div>
        <div class="p-6 sm:p-8">
          <h1 class="text-2xl font-semibold text-slate-900 sm:text-3xl">{{ title() }}</h1>
          @if (description()) {
            <p class="mt-3 whitespace-pre-line text-sm text-slate-600">{{ description() }}</p>
          }
          @if (hasRequired()) {
            <p class="mt-4 border-t border-slate-100 pt-3 text-xs text-red-600">* Indica uma pergunta obrigatória</p>
          }
        </div>
      </section>

      @for (field of fields(); track field.key) {
        @if (field.type === 'SECTION_TITLE') {
          <section class="card overflow-hidden">
            <div class="bg-brand-600 px-6 py-3 text-white sm:px-8">
              <h2 class="text-lg font-semibold">{{ field.label }}</h2>
            </div>
            @if (field.helpText) {
              <p class="whitespace-pre-line px-6 py-4 text-sm text-slate-600 sm:px-8">{{ field.helpText }}</p>
            }
          </section>
        } @else {
          @let error = errorFor(field);
          <section
            class="card p-6 transition sm:p-8"
            [class.border-red-300]="error"
            [class.ring-1]="error"
            [class.ring-red-200]="error"
            [attr.data-invalid]="error ? 'true' : null"
          >
            <h3 [id]="'q-' + field.key + '-label'" class="text-base font-medium text-slate-900">
              <label [attr.for]="'q-' + field.key">{{ field.label }}</label>
              @if (field.required) {
                <span class="ml-0.5 text-red-600" aria-label="obrigatória">*</span>
              }
            </h3>
            @if (field.helpText) {
              <p [id]="'q-' + field.key + '-help'" class="mt-1 whitespace-pre-line text-sm text-slate-500">{{ field.helpText }}</p>
            }
            <div class="mt-4">
              <app-field-input [field]="field" [control]="controlFor(field)" [invalid]="!!error" />
            </div>
            @if (error) {
              <p [id]="'q-' + field.key + '-error'" class="field-error" role="alert">
                <app-icon name="alert" [size]="16" /> {{ error }}
              </p>
            }
          </section>
        }
      }

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button type="submit" class="btn-primary px-6" [disabled]="submitting()">
          @if (submitting()) { Enviando… } @else { {{ submitLabel() }} }
        </button>
        @if (hasInputs()) {
          <button type="button" class="btn-ghost text-brand-700" (click)="reset()">Limpar formulário</button>
        }
      </div>
    </form>
  `,
})
export class FormRendererComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly fields = input.required<RenderField[]>();
  readonly submitting = input(false);
  readonly submitLabel = input('Enviar');
  /** Erros devolvidos pela API, indexados pela chave do campo. */
  readonly serverErrors = input<Record<string, string>>({});

  readonly submitted = output<Record<string, AnswerValue>>();

  private readonly resetCount = signal(0);
  private readonly attempted = signal(false);

  protected readonly form = computed(() => {
    this.resetCount();
    return buildFormGroup(this.fields());
  });
  protected readonly hasRequired = computed(() => this.fields().some((f) => f.required));
  protected readonly hasInputs = computed(() => this.fields().some(isInputField));

  protected controlFor(field: RenderField): FormControl {
    return this.form().controls[field.key];
  }

  protected errorFor(field: RenderField): string | null {
    const control = this.form().controls[field.key];
    if (!control) {
      return null;
    }
    if ((control.touched || this.attempted()) && control.invalid) {
      return errorMessage(control.errors);
    }
    // Erro do servidor só vale enquanto o valor não for alterado.
    return control.pristine ? (this.serverErrors()[field.key] ?? null) : null;
  }

  protected submit(): void {
    const form = this.form();
    this.attempted.set(true);
    form.markAllAsTouched();
    if (form.invalid) {
      this.scrollToFirstError();
      return;
    }
    // Marca como "pristine" para que erros de servidor da próxima tentativa apareçam.
    form.markAsPristine();
    this.submitted.emit(collectAnswers(this.fields(), form.getRawValue()));
  }

  reset(): void {
    this.attempted.set(false);
    this.resetCount.update((n) => n + 1);
  }

  /** Rola até o primeiro erro após a renderização (inclusive erros vindos do servidor). */
  scrollToFirstError(): void {
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector('[data-invalid="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}
