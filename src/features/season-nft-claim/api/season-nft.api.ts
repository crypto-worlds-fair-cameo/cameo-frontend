import axios, { isAxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/http-client';
import {
  SeasonNftRequestError,
  isCanonicalArweaveUrl,
  type ClaimAttemptView,
  type CreateClaimAttemptResult,
  type SeasonNftClaimView,
  type SeasonNftView,
  type SubmitClaimTransactionResult,
} from './season-nft.types';

type RecordValue = Record<string, unknown>;
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const decimal = /^(?:0|[1-9][0-9]*)$/u;
const canonicalBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
function isEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isClaim(value: unknown): value is SeasonNftClaimView {
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

function isSeasonNftView(value: unknown): value is SeasonNftView {
  if (!isRecord(value)) return false;
  return (
    typeof value.seasonId === 'string' &&
    uuidV4.test(value.seasonId) &&
    isEnum(value.network, ['devnet', 'mainnet-beta']) &&
    isEnum(value.availability, ['WAITING_FOR_END', 'PREPARING', 'READY', 'EMPTY', 'UNAVAILABLE']) &&
    (value.reason === null ||
      isEnum(value.reason, [
        'CANCELLED',
        'FORCE_ENDED',
        'FEATURE_DISABLED',
        'TOO_MANY_CONTRIBUTORS',
      ])) &&
    isNullableString(value.name) &&
    (value.imageUrl === null ||
      (typeof value.imageUrl === 'string' && isCanonicalArweaveUrl(value.imageUrl))) &&
    (value.metadataUri === null ||
      (typeof value.metadataUri === 'string' && isCanonicalArweaveUrl(value.metadataUri))) &&
    (value.eligibleCount === null ||
      (Number.isInteger(value.eligibleCount) &&
        Number(value.eligibleCount) >= 0 &&
        Number(value.eligibleCount) <= 100)) &&
    isClaim(value.claim)
  );
}

function isClaimAttempt(value: unknown): value is ClaimAttemptView {
  if (!isRecord(value)) return false;
  const transaction = value.transaction;
  const validTransaction =
    transaction === null ||
    (isRecord(transaction) &&
      typeof transaction.transactionId === 'string' &&
      uuidV4.test(transaction.transactionId) &&
      typeof transaction.serializedTransactionBase64 === 'string' &&
      transaction.serializedTransactionBase64.length > 0 &&
      transaction.serializedTransactionBase64.length <= 1644 &&
      canonicalBase64.test(transaction.serializedTransactionBase64) &&
      atob(transaction.serializedTransactionBase64).length <= 1232 &&
      typeof transaction.lastValidBlockHeight === 'string' &&
      decimal.test(transaction.lastValidBlockHeight) &&
      typeof transaction.estimatedCostLamports === 'string' &&
      decimal.test(transaction.estimatedCostLamports) &&
      isIsoDate(transaction.estimatedAt));
  return (
    typeof value.attemptId === 'string' &&
    uuidV4.test(value.attemptId) &&
    isEnum(value.state, [
      'QUEUED',
      'AWAITING_SIGNATURE',
      'SUBMITTING',
      'CONFIRMING',
      'SUCCEEDED',
      'EXPIRED',
      'FAILED',
    ]) &&
    isEnum(value.step, ['ALLOWLIST_PROOF', 'MINT']) &&
    typeof value.walletAddress === 'string' &&
    value.walletAddress.length > 0 &&
    isEnum(value.network, ['devnet', 'mainnet-beta']) &&
    validTransaction &&
    (value.state === 'AWAITING_SIGNATURE' ? transaction !== null : transaction === null) &&
    isNullableString(value.errorCode) &&
    typeof value.retryable === 'boolean'
  );
}

function isCreateResult(value: unknown): value is CreateClaimAttemptResult {
  if (
    !isRecord(value) ||
    !isEnum(value.state, ['QUEUED', 'AWAITING_SIGNATURE', 'SUBMITTING', 'CONFIRMING', 'CLAIMED'])
  ) {
    return false;
  }
  return value.state === 'CLAIMED'
    ? value.attemptId === null
    : typeof value.attemptId === 'string' && uuidV4.test(value.attemptId);
}

function isSubmitResult(value: unknown): value is SubmitClaimTransactionResult {
  return (
    isRecord(value) &&
    typeof value.attemptId === 'string' &&
    uuidV4.test(value.attemptId) &&
    isEnum(value.state, [
      'QUEUED',
      'AWAITING_SIGNATURE',
      'SUBMITTING',
      'CONFIRMING',
      'SUCCEEDED',
      'EXPIRED',
      'FAILED',
    ]) &&
    typeof value.signature === 'string' &&
    value.signature.length > 0
  );
}

/** 공통 응답 envelope에서 검증된 data만 꺼내 잘못된 성공 응답을 화면 상태로 사용하지 않는다. */
function unwrap<T>(value: unknown, validator: (candidate: unknown) => candidate is T): T {
  if (!isRecord(value) || value.success !== true || !validator(value.data)) {
    throw new SeasonNftRequestError('The server returned an invalid response.', 'invalid-response');
  }
  return value.data;
}

function normalizeError(error: unknown): never {
  if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
    throw new SeasonNftRequestError('The request was cancelled.', 'aborted');
  }
  if (error instanceof SeasonNftRequestError) throw error;
  if (!isAxiosError(error)) {
    throw new SeasonNftRequestError('The request failed.', 'transport');
  }
  const body = error.response?.data;
  if (isRecord(body) && body.success === false && typeof body.message === 'string') {
    throw new SeasonNftRequestError(
      body.message,
      'business',
      error.response?.status,
      typeof body.code === 'string' ? body.code : undefined
    );
  }
  if (error.response) {
    throw new SeasonNftRequestError(
      'The server returned an unreadable response.',
      'invalid-response',
      error.response.status
    );
  }
  throw new SeasonNftRequestError(error.message || 'The network request failed.', 'transport');
}

export async function getSeasonNft(seasonId: string, signal?: AbortSignal): Promise<SeasonNftView> {
  try {
    const response = await axiosInstance.get(`/seasons/${encodeURIComponent(seasonId)}/nft`, {
      withCredentials: true,
      signal,
    });
    return unwrap(response.data, isSeasonNftView);
  } catch (error) {
    return normalizeError(error);
  }
}

export async function createClaimAttempt(seasonId: string): Promise<CreateClaimAttemptResult> {
  try {
    const response = await axiosInstance.post(
      `/seasons/${encodeURIComponent(seasonId)}/nft/claim-attempts`,
      undefined,
      { withCredentials: true }
    );
    return unwrap(response.data, isCreateResult);
  } catch (error) {
    return normalizeError(error);
  }
}

export async function getClaimAttempt(
  seasonId: string,
  attemptId: string,
  signal?: AbortSignal
): Promise<ClaimAttemptView> {
  try {
    const response = await axiosInstance.get(
      `/seasons/${encodeURIComponent(seasonId)}/nft/claim-attempts/${encodeURIComponent(attemptId)}`,
      { withCredentials: true, signal }
    );
    return unwrap(response.data, isClaimAttempt);
  } catch (error) {
    return normalizeError(error);
  }
}

export async function submitClaimTransaction(
  seasonId: string,
  attemptId: string,
  body: { transactionId: string; signedTransactionBase64: string }
): Promise<SubmitClaimTransactionResult> {
  try {
    const response = await axiosInstance.post(
      `/seasons/${encodeURIComponent(seasonId)}/nft/claim-attempts/${encodeURIComponent(attemptId)}/transactions`,
      body,
      { withCredentials: true }
    );
    return unwrap(response.data, isSubmitResult);
  } catch (error) {
    return normalizeError(error);
  }
}
