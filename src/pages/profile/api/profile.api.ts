import { axiosInstance } from '@/shared/api/http-client';
import { isSnapshotPreviewUrl, type SeasonNftSummary } from '@/features/season-nft-claim';

interface ApiResponse<T> {
  statusCode: number;
  success: true;
  data: T;
}

export type ProfileSeasonStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type ProfileThumbnail = string | [string, string];

export interface ProfileTransaction {
  id: string;
  label: string;
  occurredAt: string;
  amountSol: number;
}

interface ProfileCanvasBase {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: ProfileSeasonStatus;
  // 이미지 URL을 사용하고, 이미지가 없는 항목은 기존 장식용 색 두 개로 표시한다.
  thumbnail: ProfileThumbnail;
}

export interface ProfileSeason extends ProfileCanvasBase {
  participantCount: number;
}

export interface ProfileActivity {
  joinedAt: string;
  balanceSol: number;
  transactions: ProfileTransaction[];
  mySeasons: ProfileSeason[];
}

export interface ParticipatedSeason {
  seasonId: string;
  title: string;
  lifecycleStatus: ProfileSeasonStatus;
  startsAt: string;
  endsAt: string;
  joinedAt: string;
  ownStrokeCount: number;
  finalImageUrl: string | null;
  nft: SeasonNftSummary;
}

export interface ParticipatedSeasonsPage {
  items: ParticipatedSeason[];
  total: number;
  limit: number;
  offset: number;
}

// 가입일·잔액·거래 내역·시즌 목록 API가 아직 없어 디자인 시안(P · 프로필)의 값을 그대로 쓴다.
// 실제 API를 연결할 때 getProfileActivity만 http-client 요청으로 교체한다.
const sampleActivity: ProfileActivity = {
  joinedAt: '2026-09-10T12:00:00Z',
  balanceSol: 1222.33,
  transactions: [
    { id: 'tx-1', label: 'Brush stroke', occurredAt: '2026-09-28T12:00:00Z', amountSol: -0.01 },
    { id: 'tx-2', label: 'Ink purchase', occurredAt: '2026-09-28T12:00:00Z', amountSol: -0.01 },
    { id: 'tx-3', label: 'Season entry', occurredAt: '2026-09-28T12:00:00Z', amountSol: -0.01 },
  ],
  mySeasons: [
    {
      id: 'season-design-the-ui',
      title: 'Design the UI',
      startsAt: '2026-10-12T12:00:00Z',
      endsAt: '2026-11-01T12:00:00Z',
      participantCount: 7,
      status: 'ended',
      thumbnail: '/images/profile/season-design-ui.png',
    },
    {
      id: 'season-pixel-battle',
      title: 'Pixel Battle',
      startsAt: '2026-09-25T12:00:00Z',
      endsAt: '2026-10-30T12:00:00Z',
      participantCount: 128,
      status: 'active',
      thumbnail: '/images/profile/season-pixel-battle.png',
    },
    {
      id: 'season-night-sky',
      title: 'Night Sky',
      startsAt: '2026-08-01T12:00:00Z',
      endsAt: '2026-08-20T12:00:00Z',
      participantCount: 64,
      status: 'ended',
      thumbnail: '/images/profile/season-night-sky.png',
    },
  ],
};

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isClaim(value: unknown): value is SeasonNftSummary['claim'] {
  if (!isRecord(value)) return false;
  return (
    isEnum(value.eligibility, ['ELIGIBLE', 'NOT_PARTICIPANT', 'NO_VALID_STROKE']) &&
    isEnum(value.state, ['UNCLAIMED', 'PROCESSING', 'CLAIMED']) &&
    isNullableString(value.walletAddress) &&
    (value.activeAttemptId === null ||
      (typeof value.activeAttemptId === 'string' && uuidV4.test(value.activeAttemptId))) &&
    isNullableString(value.assetAddress) &&
    isNullableString(value.signature) &&
    isEnum(value.receiptState, ['NONE', 'RESOLVING', 'VERIFIED']) &&
    (value.claimedAt === null || isIsoDate(value.claimedAt))
  );
}

function isSummary(value: unknown): value is SeasonNftSummary {
  return (
    isRecord(value) &&
    isEnum(value.network, ['devnet', 'mainnet-beta']) &&
    isEnum(value.availability, ['WAITING_FOR_END', 'PREPARING', 'READY', 'EMPTY', 'UNAVAILABLE']) &&
    (value.reason === null ||
      isEnum(value.reason, ['CANCELLED', 'FORCE_ENDED', 'FEATURE_DISABLED'])) &&
    isClaim(value.claim)
  );
}

function isParticipatedSeason(value: unknown): value is ParticipatedSeason {
  if (!isRecord(value)) return false;
  return (
    typeof value.seasonId === 'string' &&
    uuidV4.test(value.seasonId) &&
    typeof value.title === 'string' &&
    Array.from(value.title).length >= 1 &&
    Array.from(value.title).length <= 50 &&
    isEnum(value.lifecycleStatus, ['scheduled', 'active', 'ended', 'cancelled']) &&
    isIsoDate(value.startsAt) &&
    isIsoDate(value.endsAt) &&
    isIsoDate(value.joinedAt) &&
    Number.isSafeInteger(value.ownStrokeCount) &&
    Number(value.ownStrokeCount) >= 0 &&
    (value.finalImageUrl === null ||
      (typeof value.finalImageUrl === 'string' && isSnapshotPreviewUrl(value.finalImageUrl))) &&
    isSummary(value.nft)
  );
}

function isParticipatedPage(value: unknown): value is ParticipatedSeasonsPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isParticipatedSeason) &&
    Number.isSafeInteger(value.total) &&
    Number(value.total) >= 0 &&
    Number.isSafeInteger(value.limit) &&
    Number(value.limit) >= 1 &&
    Number(value.limit) <= 50 &&
    Number.isSafeInteger(value.offset) &&
    Number(value.offset) >= 0 &&
    value.items.length <= Number(value.limit)
  );
}

/** 인증 사용자의 실제 참여 시즌과 NFT summary를 offset 페이지로 조회한다. */
export async function getParticipatedSeasons(
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<ParticipatedSeasonsPage> {
  const response = await axiosInstance.get('/seasons/participated', {
    params: { limit, offset },
    withCredentials: true,
    signal,
  });
  const envelope = response.data as unknown;
  if (
    !isRecord(envelope) ||
    envelope.success !== true ||
    !isParticipatedPage(envelope.data) ||
    envelope.data.limit !== limit ||
    envelope.data.offset !== offset
  ) {
    throw new Error('The participated seasons response is invalid.');
  }
  return envelope.data;
}

/** 프로필 활동 샘플을 반환한다. 백엔드 요청은 하지 않는다. */
export async function getProfileActivity(): Promise<ProfileActivity> {
  return sampleActivity;
}

/** 기존 닉네임 변경 API를 사용한다. 서버는 앞뒤 공백을 제거한 1~20자만 허용한다. */
export async function updateDisplayName(displayName: string) {
  const response = await axiosInstance.patch<ApiResponse<{ id: string; displayName: string }>>(
    '/users/me/display-name',
    { displayName },
    { withCredentials: true }
  );
  if (response.status !== 200) throw new Error('Unexpected nickname update response');
  return response.data.data;
}
