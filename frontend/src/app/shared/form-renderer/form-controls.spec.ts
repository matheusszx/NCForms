import { FieldType } from '../../core/models';
import { RenderField, buildFormGroup, collectAnswers, errorMessage, scaleRange } from './form-controls';

function field(type: FieldType, key: string, extra: Partial<RenderField> = {}): RenderField {
  return { key, id: key, type, label: key, helpText: null, required: false, config: {}, options: [], ...extra };
}

describe('form-controls', () => {
  it('cria controles apenas para perguntas (não para títulos de seção)', () => {
    const group = buildFormGroup([field('SECTION_TITLE', 's'), field('SHORT_TEXT', 'a'), field('CHECKBOX', 'b')]);
    expect(Object.keys(group.controls)).toEqual(['a', 'b']);
    expect(group.controls['b'].value).toEqual([]);
  });

  it('campos obrigatórios rejeitam vazio, espaços e lista vazia', () => {
    const group = buildFormGroup([
      field('SHORT_TEXT', 'text', { required: true }),
      field('CHECKBOX', 'check', { required: true }),
      field('LONG_TEXT', 'optional'),
    ]);
    expect(group.controls['text'].hasError('required')).toBe(true);
    expect(group.controls['check'].hasError('required')).toBe(true);
    expect(group.controls['optional'].valid).toBe(true);

    group.controls['text'].setValue('   ');
    expect(group.controls['text'].hasError('required')).toBe(true);

    group.controls['text'].setValue('ok');
    group.controls['check'].setValue(['o1']);
    expect(group.valid).toBe(true);
  });

  it('valida e-mail, faixa numérica, tamanho de texto e limites de seleção', () => {
    const group = buildFormGroup([
      field('EMAIL', 'email'),
      field('NUMBER', 'age', { config: { min: 18, max: 99 } }),
      field('SHORT_TEXT', 'nick', { config: { maxLength: 3 } }),
      field('CHECKBOX', 'fruits', { config: { minSelected: 2, maxSelected: 3 } }),
    ]);
    const c = group.controls;

    c['email'].setValue('invalido');
    expect(errorMessage(c['email'].errors)).toBe('Informe um e-mail válido.');
    c['email'].setValue('a@b.co');
    expect(c['email'].valid).toBe(true);

    c['age'].setValue(10);
    expect(errorMessage(c['age'].errors)).toBe('O valor deve ser no mínimo 18.');
    c['age'].setValue(120);
    expect(errorMessage(c['age'].errors)).toBe('O valor deve ser no máximo 99.');

    c['nick'].setValue('abcd');
    expect(errorMessage(c['nick'].errors)).toBe('A resposta deve ter no máximo 3 caracteres.');

    c['fruits'].setValue(['a']);
    expect(errorMessage(c['fruits'].errors)).toBe('Selecione pelo menos 2 opções.');
    c['fruits'].setValue(['a', 'b', 'c', 'd']);
    expect(errorMessage(c['fruits'].errors)).toBe('Selecione no máximo 3 opções.');
    c['fruits'].setValue([]);
    expect(c['fruits'].valid).toBe(true); // opcional: vazio é aceito
  });

  it('collectAnswers monta o payload e omite respostas vazias', () => {
    const fields = [
      field('SECTION_TITLE', 's'),
      field('SHORT_TEXT', 'name'),
      field('NUMBER', 'age'),
      field('CHECKBOX', 'tags'),
      field('LINEAR_SCALE', 'score'),
      field('LONG_TEXT', 'empty'),
    ];
    const answers = collectAnswers(fields, {
      name: '  Ana  ',
      age: 30,
      tags: ['x', 'y'],
      score: 4,
      empty: '   ',
    });
    expect(answers).toEqual({ name: 'Ana', age: 30, tags: ['x', 'y'], score: 4 });
  });

  it('scaleRange usa limites configurados ou 1–5', () => {
    expect(scaleRange(field('LINEAR_SCALE', 'a'))).toEqual([1, 2, 3, 4, 5]);
    expect(scaleRange(field('LINEAR_SCALE', 'b', { config: { min: 0, max: 3 } }))).toEqual([0, 1, 2, 3]);
  });
});
