import { axiosInstance } from '@/shared/api/http-client';
import { isSnapshotPreviewUrl, type SeasonNftSummary } from '@/features/season-nft-claim';

interface ApiResponse<T> {
  statusCode: number;
  success: true;
  data: T;
}

export type ProfileSeasonStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type ProfileThumbnail = string | [string, string];

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

interface OffsetPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type ParticipatedSeasonsPage = OffsetPage<ParticipatedSeason>;

export interface HostedSeason {
  seasonId: string;
  title: string;
  lifecycleStatus: ProfileSeasonStatus;
  startsAt: string;
  endsAt: string;
  participantCount: number;
  finalImageUrl: string | null;
}

export type HostedSeasonsPage = OffsetPage<HostedSeason>;

export type SolanaNetwork = 'devnet' | 'mainnet-beta';

export interface WalletBalance {
  walletAddress: string;
  network: SolanaNetwork;
  lamports: string;
}

export interface ProfileTransaction {
  id: string;
  type: 'season_entry';
  direction: 'outgoing' | 'incoming';
  seasonId: string;
  seasonTitle: string;
  lamports: string;
  network: SolanaNetwork;
  signature: string;
  occurredAt: string;
}

export type TransactionsPage = OffsetPage<ProfileTransaction>;

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
    isEnum(value.eligibility, ['ELIGIBLE', 'NOT_PARTICIPANT', 'NO_VALID_STROKE', 'CREATOR']) &&
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
      isEnum(value.reason, [
        'CANCELLED',
        'FORCE_ENDED',
        'FEATURE_DISABLED',
        'TOO_MANY_CONTRIBUTORS',
      ])) &&
    isClaim(value.claim)
  );
}

function isSeasonListItem(value: Record<string, unknown>) {
  return (
    typeof value.seasonId === 'string' &&
    uuidV4.test(value.seasonId) &&
    typeof value.title === 'string' &&
    Array.from(value.title).length >= 1 &&
    Array.from(value.title).length <= 50 &&
    isEnum(value.lifecycleStatus, ['scheduled', 'active', 'ended', 'cancelled']) &&
    isIsoDate(value.startsAt) &&
    isIsoDate(value.endsAt) &&
    (value.finalImageUrl === null ||
      (typeof value.finalImageUrl === 'string' && isSnapshotPreviewUrl(value.finalImageUrl)))
  );
}

function isParticipatedSeason(value: unknown): value is ParticipatedSeason {
  if (!isRecord(value)) return false;
  return (
    isSeasonListItem(value) &&
    isIsoDate(value.joinedAt) &&
    Number.isSafeInteger(value.ownStrokeCount) &&
    Number(value.ownStrokeCount) >= 0 &&
    isSummary(value.nft)
  );
}

function isHostedSeason(value: unknown): value is HostedSeason {
  if (!isRecord(value)) return false;
  return (
    isSeasonListItem(value) &&
    Number.isSafeInteger(value.participantCount) &&
    Number(value.participantCount) >= 0
  );
}

const lamportsPattern = /^(0|[1-9]\d*)$/u;

function isTransaction(value: unknown): value is ProfileTransaction {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    uuidV4.test(value.id) &&
    value.type === 'season_entry' &&
    isEnum(value.direction, ['outgoing', 'incoming']) &&
    typeof value.seasonId === 'string' &&
    uuidV4.test(value.seasonId) &&
    typeof value.seasonTitle === 'string' &&
    typeof value.lamports === 'string' &&
    lamportsPattern.test(value.lamports) &&
    isEnum(value.network, ['devnet', 'mainnet-beta']) &&
    typeof value.signature === 'string' &&
    isIsoDate(value.occurredAt)
  );
}

function isOffsetPage<T>(
  value: unknown,
  isItem: (item: unknown) => item is T
): value is OffsetPage<T> {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
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

async function getOffsetPage<T>(
  path: string,
  isItem: (item: unknown) => item is T,
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<OffsetPage<T>> {
  const response = await axiosInstance.get(path, {
    params: { limit, offset },
    withCredentials: true,
    signal,
  });
  const envelope = response.data as unknown;
  if (
    !isRecord(envelope) ||
    envelope.success !== true ||
    !isOffsetPage(envelope.data, isItem) ||
    envelope.data.limit !== limit ||
    envelope.data.offset !== offset
  ) {
    throw new Error(`The ${path} response is invalid.`);
  }
  return envelope.data;
}

/** 인증 사용자의 실제 참여 시즌과 NFT summary를 offset 페이지로 조회한다. */
export function getParticipatedSeasons(
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<ParticipatedSeasonsPage> {
  return getOffsetPage('/seasons/participated', isParticipatedSeason, limit, offset, signal);
}

/** 인증 사용자가 개설한 시즌을 최근 개설순 offset 페이지로 조회한다. 취소·종료된 시즌도 포함한다. */
export function getHostedSeasons(
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<HostedSeasonsPage> {
  return getOffsetPage('/seasons/hosted', isHostedSeason, limit, offset, signal);
}

/** 확정된 시즌 입장료 중 내가 보낸 것과 내 시즌으로 받은 것을 최신순 offset 페이지로 조회한다. */
export function getTransactions(
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<TransactionsPage> {
  return getOffsetPage('/users/me/transactions', isTransaction, limit, offset, signal);
}

/** 현재 세션 지갑의 잔액을 서버가 설정한 Solana network에서 읽는다. */
export async function getWalletBalance(signal?: AbortSignal): Promise<WalletBalance> {
  const response = await axiosInstance.get('/users/me/balance', { withCredentials: true, signal });
  const envelope = response.data as unknown;
  const data = isRecord(envelope) && envelope.success === true ? envelope.data : undefined;
  if (
    !isRecord(data) ||
    typeof data.walletAddress !== 'string' ||
    !isEnum(data.network, ['devnet', 'mainnet-beta']) ||
    typeof data.lamports !== 'string' ||
    !lamportsPattern.test(data.lamports)
  ) {
    throw new Error('The /users/me/balance response is invalid.');
  }
  return { walletAddress: data.walletAddress, network: data.network, lamports: data.lamports };
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

/** 고른 JPG·PNG 파일을 변환 없이 본문으로 올린다. 서버가 형식·크기를 다시 검사하고 새 사진 주소를 돌려준다. */
export async function uploadProfileImage(file: File) {
  const response = await axiosInstance.put<ApiResponse<{ id: string; avatarUrl: string }>>(
    '/users/me/profile-image',
    file,
    // 최대 2MB 사진을 해외 서버로 올리므로 기본 10초보다 오래 기다린다.
    { headers: { 'Content-Type': file.type }, withCredentials: true, timeout: 60_000 }
  );
  if (response.status !== 200) throw new Error('Unexpected profile image response');
  return response.data.data;
}
