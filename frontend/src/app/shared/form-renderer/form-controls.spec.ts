import { FieldType } from '../../core/models';
import { RenderField, buildFormGroup, collectAnswers, errorMessage, scaleRange } from './form-controls';

function field(type: FieldType, key: string, extra: Partial<RenderField> = {}): RenderField {
  return { key, id: key, type, label: key, helpText: null, required: false, config: {}, options: [], ...extra };
}

describe('form-controls', () => {
  it('creates controls only for questions (not for section titles)', () => {
    const group = buildFormGroup([field('SECTION_TITLE', 's'), field('SHORT_TEXT', 'a'), field('CHECKBOX', 'b')]);
    expect(Object.keys(group.controls)).toEqual(['a', 'b']);
    expect(group.controls['b'].value).toEqual([]);
  });

  it('required fields reject empty values, whitespace and empty lists', () => {
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

  it('validates email, number range, text length and selection limits', () => {
    const group = buildFormGroup([
      field('EMAIL', 'email'),
      field('NUMBER', 'age', { config: { min: 18, max: 99 } }),
      field('SHORT_TEXT', 'nick', { config: { maxLength: 3 } }),
      field('CHECKBOX', 'fruits', { config: { minSelected: 2, maxSelected: 3 } }),
    ]);
    const c = group.controls;

    c['email'].setValue('invalid');
    expect(errorMessage(c['email'].errors)).toBe('Enter a valid email address.');
    c['email'].setValue('a@b.co');
    expect(c['email'].valid).toBe(true);

    c['age'].setValue(10);
    expect(errorMessage(c['age'].errors)).toBe('The value must be at least 18.');
    c['age'].setValue(120);
    expect(errorMessage(c['age'].errors)).toBe('The value must be at most 99.');

    c['nick'].setValue('abcd');
    expect(errorMessage(c['nick'].errors)).toBe('The answer must be at most 3 characters.');

    c['fruits'].setValue(['a']);
    expect(errorMessage(c['fruits'].errors)).toBe('Select at least 2 options.');
    c['fruits'].setValue(['a', 'b', 'c', 'd']);
    expect(errorMessage(c['fruits'].errors)).toBe('Select at most 3 options.');
    c['fruits'].setValue([]);
    expect(c['fruits'].valid).toBe(true); // optional: empty is accepted
  });

  it('collectAnswers builds the payload and omits empty answers', () => {
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

  it('scaleRange uses configured limits or 1–5', () => {
    expect(scaleRange(field('LINEAR_SCALE', 'a'))).toEqual([1, 2, 3, 4, 5]);
    expect(scaleRange(field('LINEAR_SCALE', 'b', { config: { min: 0, max: 3 } }))).toEqual([0, 1, 2, 3]);
  });
});
