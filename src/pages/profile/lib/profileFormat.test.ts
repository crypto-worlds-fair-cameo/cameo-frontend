import { describe, expect, it } from 'vitest';
import { formatActivityDate, formatDateRange, formatSol, shortenAddress } from './profileFormat';

describe('profile format', () => {
  it('shortens wallet addresses like the header account button', () => {
    expect(shortenAddress('8xQ2abcdefghijklmnop7mKP')).toBe('8xQ2…7mKP');
    expect(shortenAddress('short')).toBe('short');
  });

  it('formats lamports as grouped SOL without floating point rounding', () => {
    expect(formatSol('1222330000000', 'en', 4)).toBe('1,222.33');
    expect(formatSol('4999999', 'en', 4)).toBe('0.0049');
    expect(formatSol('10000000', 'en')).toBe('0.01');
    expect(formatSol('0', 'en')).toBe('0');
    expect(formatSol('9007199254740993000000000', 'en', 4)).toBe('9,007,199,254,740,993');
  });

  it('drops the year only for dates in the current year', () => {
    const now = new Date('2026-10-13T00:00:00Z');
    expect(formatActivityDate('2026-09-28T12:00:00Z', 'en', now)).toBe('Sep 28');
    expect(formatActivityDate('2025-09-28T12:00:00Z', 'en', now)).toBe('Sep 28, 2025');
  });

  it('omits the start year only when the range stays within one year', () => {
    expect(formatDateRange('2026-10-12T12:00:00Z', '2026-11-01T12:00:00Z', 'en')).toBe(
      'Oct 12 – Nov 1, 2026'
    );
    expect(formatDateRange('2025-12-20T12:00:00Z', '2026-01-05T12:00:00Z', 'en')).toBe(
      'Dec 20, 2025 – Jan 5, 2026'
    );
  });
});
