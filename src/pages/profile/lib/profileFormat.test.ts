import { describe, expect, it } from 'vitest';
import { formatDateRange, formatSol, shortenAddress } from './profileFormat';

describe('profile format', () => {
  it('shortens wallet addresses like the header account button', () => {
    expect(shortenAddress('8xQ2abcdefghijklmnop7mKP')).toBe('8xQ2…7mKP');
    expect(shortenAddress('short')).toBe('short');
  });

  it('marks outgoing SOL with the design minus sign', () => {
    expect(formatSol(-0.01, 'en')).toBe('−0.01 SOL');
    expect(formatSol(1222.33, 'en')).toBe('1,222.33 SOL');
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
