import { describe, expect, it } from 'vitest';
import { createInitialSeasonDraft, toLocalDateTimeInput, validateSeasonDraft } from './seasonForm';

const now = new Date('2026-10-07T00:00:00.000Z');

describe('season form contract', () => {
  it('keeps unlimited null and omits immediate startsAt and empty description', () => {
    const draft = createInitialSeasonDraft(now);
    draft.title = '  주말 🎨  ';
    draft.description = '   ';
    draft.capacity = '20';
    draft.unlimitedStrokes = true;
    draft.endsAt = toLocalDateTimeInput(new Date(now.getTime() + 24 * 60 * 60 * 1000));
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

  it('rejects blank numbers before Number conversion and counts Unicode code points', () => {
    const draft = createInitialSeasonDraft(now);
    draft.title = '😀'.repeat(51);
    draft.capacity = '';
    const result = validateSeasonDraft(draft, now);
    expect(result.errors.title).toBe('titleLength');
    expect(result.errors.capacity).toBe('requiredNumber');
    expect(result.input).toBeUndefined();
  });

  it('uses one hour for scheduled seasons and a 61 minute margin for immediate seasons', () => {
    const immediate = createInitialSeasonDraft(now);
    immediate.title = 'now';
    immediate.endsAt = toLocalDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000));
    expect(validateSeasonDraft(immediate, now).errors.endsAt).toBe('immediateDurationRange');

    const scheduled = {
      ...immediate,
      scheduled: true,
      startsAt: toLocalDateTimeInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      endsAt: toLocalDateTimeInput(new Date(now.getTime() + 25 * 60 * 60 * 1000)),
    };
    expect(validateSeasonDraft(scheduled, now).errors).toEqual({});
    expect(validateSeasonDraft(scheduled, now).input?.startsAt).toBe(
      new Date(scheduled.startsAt).toISOString()
    );
  });
});
