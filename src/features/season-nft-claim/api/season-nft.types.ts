export type SeasonNftNetwork = 'devnet' | 'mainnet-beta';
export type SeasonNftAvailability =
  'WAITING_FOR_END' | 'PREPARING' | 'READY' | 'EMPTY' | 'UNAVAILABLE';
export type SeasonNftReason = 'CANCELLED' | 'FORCE_ENDED' | 'FEATURE_DISABLED' | null;
export type ClaimEligibility = 'ELIGIBLE' | 'NOT_PARTICIPANT' | 'NO_VALID_STROKE';
export type ClaimState = 'UNCLAIMED' | 'PROCESSING' | 'CLAIMED';
export type ReceiptState = 'NONE' | 'RESOLVING' | 'VERIFIED';
export type ClaimAttemptState =
  | 'QUEUED'
  | 'AWAITING_SIGNATURE'
  | 'SUBMITTING'
  | 'CONFIRMING'
  | 'SUCCEEDED'
  | 'EXPIRED'
  | 'FAILED';
export type ClaimAttemptStep = 'ALLOWLIST_PROOF' | 'MINT';

export interface SeasonNftClaimView {
  eligibility: ClaimEligibility;
  state: ClaimState;
  walletAddress: string | null;
  activeAttemptId: string | null;
  assetAddress: string | null;
  signature: string | null;
  receiptState: ReceiptState;
  claimedAt: string | null;
}

export interface SeasonNftView {
  seasonId: string;
  network: SeasonNftNetwork;
  availability: SeasonNftAvailability;
  reason: SeasonNftReason;
  name: string | null;
  imageUrl: string | null;
  metadataUri: string | null;
  eligibleCount: number | null;
  claim: SeasonNftClaimView;
}

export type SeasonNftSummary = Pick<SeasonNftView, 'network' | 'availability' | 'reason' | 'claim'>;

export interface ClaimAttemptTransaction {
  transactionId: string;
  serializedTransactionBase64: string;
  lastValidBlockHeight: string;
  estimatedCostLamports: string;
  estimatedAt: string;
}

export interface ClaimAttemptView {
  attemptId: string;
  state: ClaimAttemptState;
  step: ClaimAttemptStep;
  walletAddress: string;
  network: SeasonNftNetwork;
  transaction: ClaimAttemptTransaction | null;
  errorCode: string | null;
  retryable: boolean;
}

export interface CreateClaimAttemptResult {
  attemptId: string | null;
  state: 'QUEUED' | 'AWAITING_SIGNATURE' | 'SUBMITTING' | 'CONFIRMING' | 'CLAIMED';
}

export interface SubmitClaimTransactionResult {
  attemptId: string;
  state: ClaimAttemptState;
  signature: string;
}

export type SeasonNftRequestErrorKind = 'aborted' | 'business' | 'transport' | 'invalid-response';

export class SeasonNftRequestError extends Error {
  readonly kind: SeasonNftRequestErrorKind;
  readonly statusCode?: number;
  readonly code?: string;

  constructor(
    message: string,
    kind: SeasonNftRequestErrorKind,
    statusCode?: number,
    code?: string
  ) {
    super(message);
    this.name = 'SeasonNftRequestError';
    this.kind = kind;
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** 인증 세션을 폐기해야 하는 NFT API 오류만 식별한다. */
export function isSessionInvalidError(error: unknown): boolean {
  return (
    error instanceof SeasonNftRequestError &&
    (error.statusCode === 401 ||
      (error.statusCode === 403 && error.code === 'AUTH_USER_UNAVAILABLE'))
  );
}

/** 영구 NFT URI가 자격 증명이나 변형 인자 없는 canonical Arweave 주소인지 검사한다. */
export function isCanonicalArweaveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'arweave.net' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      /^\/[A-Za-z0-9_-]{43}$/u.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** 시즌 스냅샷 미리보기는 자격 증명 없는 절대 HTTP(S) 주소만 허용한다. */
export function isSnapshotPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}
