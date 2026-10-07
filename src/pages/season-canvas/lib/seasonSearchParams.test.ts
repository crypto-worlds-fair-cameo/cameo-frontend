import { describe, expect, it } from 'vitest';
import { parseSeasonSearchParams } from './seasonSearchParams';

describe('season URL state', () => {
  it('normalizes duplicate, unsupported, padded and unsafe values', () => {
    const cases = [
      'status=all&page=01',
      'status=active&status=ended&page=2',
      'status=active&page=99999999999999999999999999999',
      'page=-1',
    ];
    for (const value of cases) {
      const parsed = parseSeasonSearchParams(new URLSearchParams(value));
      expect(parsed.needsReplace).toBe(true);
      expect(Number.isSafeInteger(parsed.value.page)).toBe(true);
    }
  });

  it('keeps valid status and page while omitting all and page one defaults', () => {
    const active = parseSeasonSearchParams(new URLSearchParams('status=active&page=2'));
    expect(active.value).toEqual({ status: 'active', page: 2 });
    expect(active.needsReplace).toBe(false);
    const defaults = parseSeasonSearchParams(new URLSearchParams());
    expect(defaults.normalized.toString()).toBe('');
  });
});
