import { safeReturnUrl } from './login.page';

describe('safeReturnUrl', () => {
  it('aceita apenas caminhos internos', () => {
    expect(safeReturnUrl('/forms/1/edit')).toBe('/forms/1/edit');
    expect(safeReturnUrl(undefined)).toBe('/');
    expect(safeReturnUrl('https://malicioso.com')).toBe('/');
    expect(safeReturnUrl('//malicioso.com')).toBe('/');
  });
});
