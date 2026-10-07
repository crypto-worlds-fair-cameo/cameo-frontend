import type { CreateSeasonInput } from '../api/seasons.types';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_DURATION = 30 * DAY;

export interface SeasonFormDraft {
  title: string;
  description: string;
  width: string;
  height: string;
  capacity: string;
  unlimitedStrokes: boolean;
  strokeLimitPerUser: string;
  scheduled: boolean;
  startsAt: string;
  endsAt: string;
}

export type SeasonFormField = keyof SeasonFormDraft;
export type SeasonFormErrorKey =
  | 'requiredNumber'
  | 'integerRange'
  | 'titleLength'
  | 'descriptionLength'
  | 'invalidDateTime'
  | 'scheduledStartRange'
  | 'durationRange'
  | 'immediateDurationRange';
export type SeasonFormErrors = Partial<Record<SeasonFormField, SeasonFormErrorKey>>;

export interface SeasonFormValidation {
  input?: CreateSeasonInput;
  errors: SeasonFormErrors;
}

/** 로컬 datetime-local 입력에 맞는 분 단위 문자열을 만든다. */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** 폼을 연 시점으로부터 24시간 뒤 종료되는 기본 입력을 만든다. */
export function createInitialSeasonDraft(now = new Date()): SeasonFormDraft {
  const endsAt = new Date(now.getTime() + DAY);
  const startsAt = new Date(now.getTime() + DAY);
  return {
    title: '',
    description: '',
    width: '1000',
    height: '1000',
    capacity: '20',
    unlimitedStrokes: false,
    strokeLimitPerUser: '1',
    scheduled: false,
    startsAt: toLocalDateTimeInput(startsAt),
    endsAt: toLocalDateTimeInput(endsAt),
  };
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function parseInteger(
  value: string,
  field: SeasonFormField,
  min: number,
  max: number,
  errors: SeasonFormErrors
): number | undefined {
  if (value.trim() === '') {
    errors[field] = 'requiredNumber';
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) {
    errors[field] = 'integerRange';
    return undefined;
  }
  return number;
}

/** datetime-local 값을 로컬 시각으로 엄격히 해석해 DST 자동 보정도 거절한다. */
function parseLocalDateTime(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || toLocalDateTimeInput(date) !== value) return undefined;
  return date;
}

/** 폼 문자열을 서버 DTO로 바꾸며 즉시 시작은 startsAt을 넣지 않는다. */
export function validateSeasonDraft(
  draft: SeasonFormDraft,
  now = new Date()
): SeasonFormValidation {
  const errors: SeasonFormErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (codePointLength(title) < 1 || codePointLength(title) > 50) errors.title = 'titleLength';
  if (codePointLength(description) > 100) errors.description = 'descriptionLength';
  const width = parseInteger(draft.width, 'width', 500, 10_000, errors);
  const height = parseInteger(draft.height, 'height', 500, 10_000, errors);
  const capacity = parseInteger(draft.capacity, 'capacity', 2, 100, errors);
  const strokeLimit = draft.unlimitedStrokes
    ? null
    : parseInteger(draft.strokeLimitPerUser, 'strokeLimitPerUser', 1, 10, errors);
  const startsAt = draft.scheduled ? parseLocalDateTime(draft.startsAt) : undefined;
  const endsAt = parseLocalDateTime(draft.endsAt);
  if (draft.scheduled && !startsAt) errors.startsAt = 'invalidDateTime';
  if (!endsAt) errors.endsAt = 'invalidDateTime';

  if (draft.scheduled && startsAt) {
    // 예약 시작은 미래이며 현재부터 30일 이내여야 한다.
    if (startsAt.getTime() <= now.getTime() || startsAt.getTime() - now.getTime() > MAX_DURATION) {
      errors.startsAt = 'scheduledStartRange';
    }
  }
  if (endsAt) {
    const startMs = startsAt?.getTime() ?? now.getTime();
    const minimumDuration = draft.scheduled ? 60 * MINUTE : 61 * MINUTE;
    const duration = endsAt.getTime() - startMs;
    if (duration < minimumDuration || duration > MAX_DURATION) {
      errors.endsAt = draft.scheduled ? 'durationRange' : 'immediateDurationRange';
    }
  }

  if (Object.keys(errors).length > 0 || width === undefined || height === undefined) {
    return { errors };
  }
  if (capacity === undefined || strokeLimit === undefined || !endsAt) return { errors };

  const input: CreateSeasonInput = {
    title,
    width,
    height,
    capacity,
    strokeLimitPerUser: strokeLimit,
    endsAt: endsAt.toISOString(),
  };
  // 빈 설명은 null 대신 필드를 생략하고 예약에서만 절대 시작 시각을 전달한다.
  if (description) input.description = description;
  if (draft.scheduled && startsAt) input.startsAt = startsAt.toISOString();
  return { input, errors };
}
