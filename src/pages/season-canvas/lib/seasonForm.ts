import type { CreateSeasonInput, SeasonEntryRule } from '../api/seasons.types';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_DURATION = 30 * DAY;
const LAMPORTS_PER_SOL = 1_000_000_000n;
/** 서버 입장료 범위. 0.001 SOL 미만은 빈 수령 지갑으로 전송이 실패할 수 있다. */
const MIN_ENTRY_FEE_LAMPORTS = 1_000_000n;
const MAX_ENTRY_FEE_LAMPORTS = 100n * LAMPORTS_PER_SOL;

export interface SeasonFormDraft {
  title: string;
  description: string;
  width: string;
  height: string;
  unlimitedCapacity: boolean;
  capacity: string;
  unlimitedStrokes: boolean;
  strokeLimitPerUser: string;
  entryRule: SeasonEntryRule;
  paidEntry: boolean;
  entryFee: string;
  scheduled: boolean;
  startsAt: string;
  endsAt: string;
}

export type SeasonFormField = keyof SeasonFormDraft;
export type SeasonFormErrorKey =
  | 'requiredNumber'
  | 'integerRange'
  | 'entryFeeRange'
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

/** 시즌 시각은 항상 UTC로 다룬다. 날짜·시간 입력에 맞는 UTC 분 단위 문자열을 만든다. */
export function toUtcDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

/** 입력 문자열(YYYY-MM-DDTHH:mm)을 UTC 시각으로 엄격히 해석한다. 없는 날짜는 거절한다. */
export function parseUtcDateTimeInput(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00Z`);
  if (Number.isNaN(date.getTime()) || toUtcDateTimeInput(date) !== value) return undefined;
  return date;
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
    unlimitedCapacity: false,
    capacity: '20',
    unlimitedStrokes: false,
    strokeLimitPerUser: '1',
    entryRule: 'anyone',
    paidEntry: false,
    entryFee: '',
    scheduled: false,
    startsAt: toUtcDateTimeInput(startsAt),
    endsAt: toUtcDateTimeInput(endsAt),
  };
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** 서버 시즌 제목·설명 제한. 입력 중 글자 수도 앞뒤 공백을 뺀 Unicode code point로 센다. */
export const TITLE_MAX_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 1000;

export function textLength(value: string): number {
  return codePointLength(value.trim());
}

/** 입력칸이 디자인 한도를 넘지 않게 앞부분만 남긴다. */
export function limitText(value: string, max: number): string {
  const characters = Array.from(value);
  return characters.length <= max ? value : characters.slice(0, max).join('');
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

/** SOL 소수 문자열을 부동소수 오차 없이 lamports 10진 문자열로 바꾼다. */
function parseEntryFee(value: string, errors: SeasonFormErrors): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    errors.entryFee = 'requiredNumber';
    return undefined;
  }
  const match = /^(\d{1,3})(?:\.(\d{1,9}))?$/.exec(trimmed);
  const lamports = match
    ? BigInt(match[1]) * LAMPORTS_PER_SOL + BigInt((match[2] ?? '').padEnd(9, '0'))
    : undefined;
  if (
    lamports === undefined ||
    lamports < MIN_ENTRY_FEE_LAMPORTS ||
    lamports > MAX_ENTRY_FEE_LAMPORTS
  ) {
    errors.entryFee = 'entryFeeRange';
    return undefined;
  }
  return lamports.toString();
}

/** lamports 10진 문자열을 뒤 0 없이 SOL 표기로 바꾼다. */
export function formatSol(lamports: string): string {
  const value = BigInt(lamports);
  const whole = value / LAMPORTS_PER_SOL;
  const fraction = (value % LAMPORTS_PER_SOL).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** 폼 문자열을 서버 DTO로 바꾸며 즉시 시작은 startsAt을 넣지 않는다. */
export function validateSeasonDraft(
  draft: SeasonFormDraft,
  now = new Date()
): SeasonFormValidation {
  const errors: SeasonFormErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (textLength(title) < 1 || textLength(title) > TITLE_MAX_LENGTH) errors.title = 'titleLength';
  if (textLength(description) > DESCRIPTION_MAX_LENGTH) errors.description = 'descriptionLength';
  const width = parseInteger(draft.width, 'width', 500, 10_000, errors);
  const height = parseInteger(draft.height, 'height', 500, 10_000, errors);
  const capacity = draft.unlimitedCapacity
    ? null
    : parseInteger(draft.capacity, 'capacity', 2, 100, errors);
  const strokeLimit = draft.unlimitedStrokes
    ? null
    : parseInteger(draft.strokeLimitPerUser, 'strokeLimitPerUser', 1, 10, errors);
  const entryFeeLamports = draft.paidEntry ? parseEntryFee(draft.entryFee, errors) : '0';
  const startsAt = draft.scheduled ? parseUtcDateTimeInput(draft.startsAt) : undefined;
  const endsAt = parseUtcDateTimeInput(draft.endsAt);
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
  if (
    capacity === undefined ||
    strokeLimit === undefined ||
    entryFeeLamports === undefined ||
    !endsAt
  ) {
    return { errors };
  }

  const input: CreateSeasonInput = {
    title,
    width,
    height,
    capacity,
    strokeLimitPerUser: strokeLimit,
    entryRule: draft.entryRule,
    entryFeeLamports,
    endsAt: endsAt.toISOString(),
  };
  // 빈 설명은 null 대신 필드를 생략하고 예약에서만 절대 시작 시각을 전달한다.
  if (description) input.description = description;
  if (draft.scheduled && startsAt) input.startsAt = startsAt.toISOString();
  return { input, errors };
}
