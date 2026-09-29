import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';

import { PublicApi } from '../../core/api/forms.api';
import { toApiError } from '../../core/api-error';
import { AnswerValue, PublicForm } from '../../core/models';
import { FormRendererComponent } from '../../shared/form-renderer/form-renderer.component';
import { RenderField } from '../../shared/form-renderer/form-controls';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import { LogoComponent } from '../../shared/ui/logo.component';

type PageState = 'loading' | 'ready' | 'submitted' | 'not-found' | 'closed' | 'error';

@Component({
  selector: 'app-public-form-page',
  imports: [FormRendererComponent, IconComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-brand-50/60 px-4 py-8 sm:py-12">
      <div class="mx-auto max-w-2xl">
        @switch (state()) {
          @case ('loading') {
            <div class="card animate-pulse p-8">
              <div class="h-7 w-2/3 rounded bg-slate-200"></div>
              <div class="mt-4 h-4 w-full rounded bg-slate-100"></div>
              <div class="mt-2 h-4 w-5/6 rounded bg-slate-100"></div>
            </div>
          }
          @case ('ready') {
            <app-form-renderer
              [title]="form()!.title"
              [description]="form()!.description"
              [fields]="fields()"
              [submitting]="submitting()"
              [serverErrors]="serverErrors()"
              (submitted)="submit($event)"
            />
            @if (submitError()) {
              <p class="field-error mt-4" role="alert"><app-icon name="alert" [size]="16" />{{ submitError() }}</p>
            }
          }
          @case ('submitted') {
            <section class="card overflow-hidden">
              <div class="h-2.5 bg-brand-600"></div>
              <div class="p-8">
                <h1 class="text-2xl font-semibold text-slate-900">{{ form()?.title }}</h1>
                <p class="mt-4 flex items-center gap-2 text-slate-700">
                  <app-icon name="check-circle" class="text-emerald-600" /> Sua resposta foi registrada. Obrigado!
                </p>
                <button type="button" class="btn-ghost mt-6 px-0 text-brand-700 hover:bg-transparent hover:underline" (click)="answerAgain()">
                  Enviar outra resposta
                </button>
              </div>
            </section>
          }
          @default {
            <section class="card p-8 text-center">
              <app-icon [name]="message().icon" [size]="40" class="mx-auto text-slate-400" />
              <h1 class="mt-4 text-xl font-semibold text-slate-900">{{ message().title }}</h1>
              <p class="mt-2 text-sm text-slate-600">{{ message().text }}</p>
              @if (state() === 'error') {
                <button type="button" class="btn-secondary mt-6" (click)="load()">Tentar novamente</button>
              }
            </section>
          }
        }
        <footer class="mt-10 flex justify-center opacity-70">
          <span class="flex items-center gap-2 text-xs text-slate-500">Criado com <app-logo class="scale-75" /></span>
        </footer>
      </div>
    </div>
  `,
})
export class PublicFormPage implements OnInit {
  private readonly api = inject(PublicApi);
  private readonly titleService = inject(Title);

  readonly slug = input.required<string>();

  private readonly renderer = viewChild(FormRendererComponent);

  protected readonly state = signal<PageState>('loading');
  protected readonly form = signal<PublicForm | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});
  protected readonly submitError = signal<string | null>(null);

  protected readonly fields = computed<RenderField[]>(() =>
    (this.form()?.fields ?? []).map((f) => ({ ...f, key: f.id! })),
  );

  protected readonly message = computed<{ icon: IconName; title: string; text: string }>(() => {
    switch (this.state()) {
      case 'closed':
        return {
          icon: 'lock',
          title: 'Formulário fechado',
          text: 'Este formulário não está mais aceitando respostas.',
        };
      case 'not-found':
        return {
          icon: 'file',
          title: 'Formulário não encontrado',
          text: 'Verifique se o link está correto ou peça um novo link a quem o enviou.',
        };
      default:
        return {
          icon: 'alert',
          title: 'Não foi possível carregar o formulário',
          text: 'Verifique sua conexão e tente novamente.',
        };
    }
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.api.getForm(this.slug()).subscribe({
      next: (form) => {
        this.form.set(form);
        this.titleService.setTitle(`${form.title} · NCForms`);
        this.state.set('ready');
      },
      error: (err) => this.state.set(this.stateForError(toApiError(err).status)),
    });
  }

  protected submit(answers: Record<string, AnswerValue>): void {
    this.submitting.set(true);
    this.submitError.set(null);
    this.serverErrors.set({});
    this.api.submit(this.slug(), answers).subscribe({
      next: () => {
        this.submitting.set(false);
        this.state.set('submitted');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.submitting.set(false);
        const apiError = toApiError(err);
        if (apiError.status === 404 || apiError.status === 410) {
          this.state.set(this.stateForError(apiError.status));
          return;
        }
        this.serverErrors.set(apiError.fieldErrors);
        this.submitError.set(apiError.message);
        this.renderer()?.scrollToFirstError();
      },
    });
  }

  protected answerAgain(): void {
    this.serverErrors.set({});
    this.submitError.set(null);
    this.state.set('ready');
  }

  private stateForError(status: number): PageState {
    if (status === 404) {
      return 'not-found';
    }
    if (status === 410) {
      return 'closed';
    }
    return 'error';
  }
}
