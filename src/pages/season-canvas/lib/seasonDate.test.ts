import { describe, expect, it } from 'vitest';
import { formatSeasonDateRange, formatSeasonDateTime, getSeasonDaysRemaining } from './seasonDate';

const now = Date.parse('2026-10-07T00:00:00.000Z');

describe('season card dates', () => {
  it('shows local dates with padded fields, 24-hour time and no seconds', () => {
    expect(formatSeasonDateTime(new Date(2026, 0, 2, 0, 5, 49).toISOString())).toBe(
      '2026.01.02 00:05'
    );
    expect(formatSeasonDateTime('invalid')).toBe('invalid');
  });

  it('shows the year once for a date range within the same year and collapses a single day', () => {
    const start = new Date(2026, 9, 12, 12).toISOString();
    const end = new Date(2026, 10, 1, 12).toISOString();
    expect(formatSeasonDateRange(start, end, 'en')).toBe('Oct 12 – Nov 1, 2026');
    expect(formatSeasonDateRange(start, start, 'en')).toBe('Oct 12, 2026');
  });

  it('keeps both years when the season crosses into a new year', () => {
    expect(
      formatSeasonDateRange(
        new Date(2026, 11, 31, 12).toISOString(),
        new Date(2027, 0, 1, 12).toISOString(),
        'en'
      )
    ).toBe('Dec 31, 2026 – Jan 1, 2027');
  });

  it('rounds a partial remaining day up and counts scheduled seasons to their end', () => {
    expect(
      getSeasonDaysRemaining({ status: 'active', endsAt: '2026-10-07T01:00:00.000Z' }, now)
    ).toBe(1);
    expect(
      getSeasonDaysRemaining({ status: 'scheduled', endsAt: '2026-10-21T00:00:00.000Z' }, now)
    ).toBe(14);
  });

  it('keeps an expired active season at D-0 until the server updates its status', () => {
    expect(
      getSeasonDaysRemaining({ status: 'active', endsAt: '2026-10-06T00:00:00.000Z' }, now)
    ).toBe(0);
  });

  it.each(['ended', 'cancelled'] as const)(
    'does not show a countdown for %s even if its scheduled end is in the future',
    status => {
      expect(getSeasonDaysRemaining({ status, endsAt: '2026-10-21T00:00:00.000Z' }, now)).toBe(
        null
      );
    }
  );

  it('omits unreadable countdowns and preserves invalid or reversed ranges without throwing', () => {
    expect(getSeasonDaysRemaining({ status: 'active', endsAt: 'invalid' }, now)).toBe(null);
    expect(formatSeasonDateRange('invalid', '2026-10-07', 'en')).toBe('invalid – 2026-10-07');
    expect(formatSeasonDateRange('2026-10-08', '2026-10-07', 'en')).toBe('2026-10-08 – 2026-10-07');
  });
});
