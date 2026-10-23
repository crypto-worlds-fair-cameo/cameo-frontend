import { describe, expect, it } from 'vitest';
import {
  createInitialSeasonDraft,
  formatSol,
  toUtcDateTimeInput,
  validateSeasonDraft,
} from './seasonForm';

const now = new Date('2026-10-07T00:00:00.000Z');

describe('season form contract', () => {
  it('keeps unlimited null and omits immediate startsAt and empty description', () => {
    const draft = createInitialSeasonDraft(now);
    draft.title = '  주말 🎨  ';
    draft.description = '   ';
    draft.capacity = '20';
    draft.unlimitedStrokes = true;
    draft.endsAt = toUtcDateTimeInput(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const result = validateSeasonDraft(draft, now);
    expect(result.errors).toEqual({});
    expect(result.input).toMatchObject({
      title: '주말 🎨',
      capacity: 20,
      strokeLimitPerUser: null,
    });
    expect(result.input).not.toHaveProperty('startsAt');
    expect(result.input).not.toHaveProperty('description');
  });

  it('accepts a 1000-character description and rejects one more code point', () => {
    const draft = createInitialSeasonDraft(now);
    draft.title = 'now';
    draft.description = '가'.repeat(1000);
    draft.endsAt = toUtcDateTimeInput(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const accepted = validateSeasonDraft(draft, now);
    expect(accepted.errors.description).toBeUndefined();
    expect(accepted.input?.description).toHaveLength(1000);

    draft.description = '가'.repeat(1001);
    expect(validateSeasonDraft(draft, now).errors.description).toBe('descriptionLength');
  });

  it('rejects blank numbers before Number conversion and counts Unicode code points', () => {
    const draft = createInitialSeasonDraft(now);
    draft.title = '😀'.repeat(51);
    draft.capacity = '';
    const result = validateSeasonDraft(draft, now);
    expect(result.errors.title).toBe('titleLength');
    expect(result.errors.capacity).toBe('requiredNumber');
    expect(result.input).toBeUndefined();
  });

  it('sends null capacity, the entry rule and an exact lamports fee', () => {
    const draft = createInitialSeasonDraft(now);
    draft.title = 'paid';
    draft.unlimitedCapacity = true;
    draft.capacity = '';
    draft.entryRule = 'wallet_holders';
    draft.paidEntry = true;
    draft.entryFee = '0.1';
    expect(validateSeasonDraft(draft, now).input).toMatchObject({
      capacity: null,
      entryRule: 'wallet_holders',
      entryFeeLamports: '100000000',
    });
    expect(formatSol('100000000')).toBe('0.1');

    for (const fee of ['0.0009', '100.000000001', '1e3', '']) {
      draft.entryFee = fee;
      expect(validateSeasonDraft(draft, now).errors.entryFee).toBe(
        fee === '' ? 'requiredNumber' : 'entryFeeRange'
      );
    }
    draft.paidEntry = false;
    expect(validateSeasonDraft(draft, now).input?.entryFeeLamports).toBe('0');
  });

  it('uses one hour for scheduled seasons and a 61 minute margin for immediate seasons', () => {
    const immediate = createInitialSeasonDraft(now);
    immediate.title = 'now';
    immediate.endsAt = toUtcDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000));
    expect(validateSeasonDraft(immediate, now).errors.endsAt).toBe('immediateDurationRange');

    const scheduled = {
      ...immediate,
      scheduled: true,
      startsAt: toUtcDateTimeInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      endsAt: toUtcDateTimeInput(new Date(now.getTime() + 25 * 60 * 60 * 1000)),
    };
    expect(validateSeasonDraft(scheduled, now).errors).toEqual({});
    expect(validateSeasonDraft(scheduled, now).input?.startsAt).toBe(
      new Date(`${scheduled.startsAt}:00Z`).toISOString()
    );
  });
});
