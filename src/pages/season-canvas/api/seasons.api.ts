import axios, { isAxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/http-client';
import {
  SeasonRequestError,
  type CreateSeasonInput,
  type ListSeasonHoldersInput,
  type ListSeasonsInput,
  type Season,
  type SeasonEntryPayment,
  type SeasonHoldersPage,
  type SeasonPage,
} from './seasons.types';

interface SuccessEnvelope<T> {
  statusCode: number;
  success: true;
  data: T;
}

/** 2xx 응답도 공통 envelope와 필요한 data가 없으면 성공으로 해석하지 않는다. */
function unwrapEnvelope<T>(value: unknown, isData: (data: unknown) => data is T): T {
  if (!isRecord(value) || value.success !== true || !isData(value.data)) {
    throw new SeasonRequestError('The server returned an invalid response.', 'invalid-response');
  }
  return (value as unknown as SuccessEnvelope<T>).data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSeason(value: unknown): value is Season {
  if (!isRecord(value)) return false;
  const nullableStrings = ['description', 'cancelledAt', 'forceEndedAt'] as const;
  const strings = [
    'id',
    'creatorId',
    'title',
    'startsAt',
    'endsAt',
    'createdAt',
    'status',
  ] as const;
  const numbers = ['width', 'height', 'participantCount'] as const;
  const booleans = ['isParticipant', 'isCreator', 'canCancel', 'canEnd'] as const;
  const hasValidDates = ['startsAt', 'endsAt', 'createdAt'].every(
    key => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key] as string))
  );
  const hasValidNullableDates = ['cancelledAt', 'forceEndedAt'].every(
    key =>
      value[key] === null ||
      (typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key] as string)))
  );
  return (
    strings.every(key => typeof value[key] === 'string') &&
    numbers.every(key => typeof value[key] === 'number') &&
    booleans.every(key => typeof value[key] === 'boolean') &&
    nullableStrings.every(key => value[key] === null || typeof value[key] === 'string') &&
    hasValidDates &&
    hasValidNullableDates &&
    (value.strokeLimitPerUser === null || typeof value.strokeLimitPerUser === 'number') &&
    (value.capacity === null || typeof value.capacity === 'number') &&
    (value.entryRule === 'anyone' || value.entryRule === 'wallet_holders') &&
    typeof value.entryFeeLamports === 'string' &&
    /^(?:0|[1-9][0-9]*)$/.test(value.entryFeeLamports) &&
    ['scheduled', 'active', 'ended', 'cancelled'].includes(String(value.status))
  );
}

function isEntryPayment(value: unknown): value is SeasonEntryPayment {
  return (
    isRecord(value) &&
    typeof value.paymentId === 'string' &&
    typeof value.seasonId === 'string' &&
    ['AWAITING_SIGNATURE', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'EXPIRED'].includes(
      String(value.status)
    ) &&
    (value.network === 'devnet' || value.network === 'mainnet-beta') &&
    typeof value.lamports === 'string' &&
    typeof value.payerAddress === 'string' &&
    typeof value.recipientAddress === 'string' &&
    (value.serializedTransactionBase64 === null ||
      typeof value.serializedTransactionBase64 === 'string') &&
    (value.signature === null || typeof value.signature === 'string') &&
    typeof value.expiresAt === 'string'
  );
}

function isSeasonPage(value: unknown): value is SeasonPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isSeason) &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number' &&
    typeof value.hasNext === 'boolean'
  );
}

/** 이미지 태그에 넣을 스냅샷 주소는 자격 증명 없는 절대 HTTP(S) 주소만 허용한다. */
function isSnapshotImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSnapshotHistory(value: unknown): value is { items: { imageUrl: string }[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(item => isRecord(item) && isSnapshotImageUrl(item.imageUrl))
  );
}

const base58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;

function isSeasonHoldersPage(value: unknown): value is SeasonHoldersPage {
  if (!isRecord(value)) return false;
  const { collection } = value;
  return (
    Array.isArray(value.items) &&
    value.items.every(
      item =>
        isRecord(item) &&
        (item.displayName === null || typeof item.displayName === 'string') &&
        typeof item.walletAddress === 'string' &&
        (item.amount === null || (typeof item.amount === 'number' && item.amount > 0))
    ) &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number' &&
    typeof value.total === 'number' &&
    (collection === null ||
      (isRecord(collection) &&
        (collection.network === 'devnet' || collection.network === 'mainnet-beta') &&
        typeof collection.address === 'string' &&
        base58Address.test(collection.address)))
  );
}

/** Axios 오류를 업무 오류, 전송 오류, 취소로 나눠 UI가 안전한 후속 동작을 고르게 한다. */
function normalizeError(error: unknown): never {
  if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
    throw new SeasonRequestError('The request was cancelled.', 'aborted');
  }
  if (!isAxiosError(error)) {
    if (error instanceof SeasonRequestError) throw error;
    throw new SeasonRequestError('The request failed.', 'transport');
  }
  const body = error.response?.data;
  if (isRecord(body) && body.success === false && typeof body.message === 'string') {
    throw new SeasonRequestError(
      body.message,
      'business',
      error.response?.status,
      typeof body.code === 'string' ? body.code : undefined,
      typeof body.traceId === 'string' ? body.traceId : undefined
    );
  }
  if (error.response) {
    throw new SeasonRequestError(
      'The server returned an unreadable response.',
      'invalid-response',
      error.response.status
    );
  }
  throw new SeasonRequestError(error.message || 'The network request failed.', 'transport');
}

/** 세션 쿠키를 포함해 시즌 목록을 조회하고 envelope의 data만 반환한다. */
export async function listSeasons(
  input: ListSeasonsInput,
  signal?: AbortSignal
): Promise<SeasonPage> {
  const params = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
  // 전체 필터에서는 서버가 지원하지 않는 all 값을 보내지 않는다.
  if (input.status) params.set('status', input.status);
  try {
    const response = await axiosInstance.get(`/seasons?${params.toString()}`, {
      withCredentials: true,
      signal,
    });
    return unwrapEnvelope(response.data, isSeasonPage);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 세션별 권한 플래그가 포함된 최신 시즌 상세를 조회한다. */
export async function getSeason(id: string, signal?: AbortSignal): Promise<Season> {
  try {
    const response = await axiosInstance.get(`/seasons/${encodeURIComponent(id)}`, {
      withCredentials: true,
      signal,
    });
    return unwrapEnvelope(response.data, isSeason);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 시즌 도화지의 가장 최근 스냅샷 이미지 주소를 조회한다. 아직 찍힌 스냅샷이 없으면 null이다. */
export async function getLatestSeasonSnapshotUrl(
  seasonId: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await axiosInstance.get(
      `/canvases/${encodeURIComponent(seasonId)}/history?limit=1`,
      { withCredentials: true, signal }
    );
    return unwrapEnvelope(response.data, isSnapshotHistory).items[0]?.imageUrl ?? null;
  } catch (error) {
    return normalizeError(error);
  }
}

/**
 * 개설자(맨 앞)와, 유료 시즌은 입장료를 낸 참가자, 무료 시즌은 획을 남긴 참가자의 NFT 수령 수량을 쪽 단위로 조회한다.
 * 검색어는 이름·지갑 주소의 부분 일치다.
 */
export async function listSeasonHolders(
  seasonId: string,
  input: ListSeasonHoldersInput,
  signal?: AbortSignal
): Promise<SeasonHoldersPage> {
  const params = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
  const search = input.search?.trim();
  if (search) params.set('search', search);
  try {
    const response = await axiosInstance.get(
      `/seasons/${encodeURIComponent(seasonId)}/holders?${params.toString()}`,
      { withCredentials: true, signal }
    );
    return unwrapEnvelope(response.data, isSeasonHoldersPage);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 재시도 없이 시즌을 한 번 생성하며, 서버가 정규화한 시즌 상세를 반환한다. */
export async function createSeason(input: CreateSeasonInput): Promise<Season> {
  try {
    const response = await axiosInstance.post('/seasons', input, { withCredentials: true });
    return unwrapEnvelope(response.data, isSeason);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 예약 시즌을 취소하고 취소 시각이 포함된 상세를 반환한다. */
export async function cancelSeason(id: string): Promise<Season> {
  try {
    const response = await axiosInstance.post(
      `/seasons/${encodeURIComponent(id)}/cancel`,
      undefined,
      {
        withCredentials: true,
      }
    );
    return unwrapEnvelope(response.data, isSeason);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 진행 중 시즌을 조기 종료하고 실제 종료 시각이 포함된 상세를 반환한다. */
export async function endSeason(id: string): Promise<Season> {
  try {
    const response = await axiosInstance.post(`/seasons/${encodeURIComponent(id)}/end`, undefined, {
      withCredentials: true,
    });
    return unwrapEnvelope(response.data, isSeason);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 같은 세션과 시즌의 참가 재요청은 멱등하며 최신 참가 상태를 반환한다. */
export async function joinSeason(id: string): Promise<Season> {
  try {
    const response = await axiosInstance.post(
      `/seasons/${encodeURIComponent(id)}/join`,
      undefined,
      {
        withCredentials: true,
      }
    );
    return unwrapEnvelope(response.data, isSeason);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 유료 시즌 입장료 거래를 준비한다. 진행 중인 결제가 있으면 서버가 그 결제를 돌려준다. */
export async function prepareSeasonEntryPayment(seasonId: string): Promise<SeasonEntryPayment> {
  try {
    const response = await axiosInstance.post(
      `/seasons/${encodeURIComponent(seasonId)}/entry-payments`,
      undefined,
      { withCredentials: true }
    );
    return unwrapEnvelope(response.data, isEntryPayment);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 지갑이 서명한 입장료 거래를 서버에 제출한다. */
export async function submitSeasonEntryTransaction(
  seasonId: string,
  paymentId: string,
  signedTransactionBase64: string
): Promise<SeasonEntryPayment> {
  try {
    const response = await axiosInstance.post(
      `/seasons/${encodeURIComponent(seasonId)}/entry-payments/${encodeURIComponent(paymentId)}/transaction`,
      { signedTransactionBase64 },
      { withCredentials: true }
    );
    return unwrapEnvelope(response.data, isEntryPayment);
  } catch (error) {
    return normalizeError(error);
  }
}

/** 제출한 입장료 거래의 체인 확정 여부를 조회한다. 확정되면 서버가 참가를 기록한다. */
export async function getSeasonEntryPayment(
  seasonId: string,
  paymentId: string
): Promise<SeasonEntryPayment> {
  try {
    const response = await axiosInstance.get(
      `/seasons/${encodeURIComponent(seasonId)}/entry-payments/${encodeURIComponent(paymentId)}`,
      { withCredentials: true }
    );
    return unwrapEnvelope(response.data, isEntryPayment);
  } catch (error) {
    return normalizeError(error);
  }
}
