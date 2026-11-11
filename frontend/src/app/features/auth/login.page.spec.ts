import { safeReturnUrl } from './login.page';

describe('safeReturnUrl', () => {
  it('only accepts internal paths', () => {
    expect(safeReturnUrl('/forms/1/edit')).toBe('/forms/1/edit');
    expect(safeReturnUrl(undefined)).toBe('/');
    expect(safeReturnUrl('https://malicious.com')).toBe('/');
    expect(safeReturnUrl('//malicious.com')).toBe('/');
  });
});
