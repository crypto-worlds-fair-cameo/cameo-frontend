export type SeasonStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export type SeasonListStatus = Exclude<SeasonStatus, 'cancelled'>;

/** anyone은 손님도 관람하고, wallet_holders는 지갑으로 로그인한 사용자만 캔버스에 입장한다. */
export type SeasonEntryRule = 'anyone' | 'wallet_holders';

export interface Season {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  width: number;
  height: number;
  strokeLimitPerUser: number | null;
  /** null이면 정원 무제한. */
  capacity: number | null;
  entryRule: SeasonEntryRule;
  /** lamports 10진 문자열. '0'이면 무료. */
  entryFeeLamports: string;
  participantCount: number;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  forceEndedAt: string | null;
  createdAt: string;
  status: SeasonStatus;
  isParticipant: boolean;
  isCreator: boolean;
  canCancel: boolean;
  canEnd: boolean;
}

export interface SeasonPage {
  items: Season[];
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface ListSeasonsInput {
  status?: SeasonListStatus;
  page: number;
  limit: number;
}

/** 획을 하나 이상 남긴 참가자. amount는 받은 시즌 NFT 수량이며 아직 받지 않았으면 null이다. */
export interface SeasonHolder {
  displayName: string | null;
  walletAddress: string;
  amount: number | null;
}

export interface SeasonHoldersPage {
  items: SeasonHolder[];
  page: number;
  limit: number;
  total: number;
  /** 시즌 NFT 준비가 끝난 경우에만 있다. */
  collection: { network: 'devnet' | 'mainnet-beta'; address: string } | null;
}

export interface ListSeasonHoldersInput {
  page: number;
  limit: number;
  search?: string;
}

export interface CreateSeasonInput {
  title: string;
  description?: string;
  width: number;
  height: number;
  strokeLimitPerUser: number | null;
  capacity: number | null;
  entryRule?: SeasonEntryRule;
  entryFeeLamports?: string;
  startsAt?: string;
  endsAt: string;
}

export type SeasonEntryPaymentStatus =
  'AWAITING_SIGNATURE' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';

export interface SeasonEntryPayment {
  paymentId: string;
  seasonId: string;
  status: SeasonEntryPaymentStatus;
  network: 'devnet' | 'mainnet-beta';
  lamports: string;
  payerAddress: string;
  recipientAddress: string;
  serializedTransactionBase64: string | null;
  signature: string | null;
  expiresAt: string;
}

export type SeasonRequestErrorKind = 'aborted' | 'business' | 'transport' | 'invalid-response';

/** 서버 오류가 아닌 지갑 서명 실패와 결제 확정 대기 초과도 시즌 오류 코드로 전달한다. */
export const WALLET_SIGNING_FAILED = 'WALLET_SIGNING_FAILED';
export const ENTRY_PAYMENT_PENDING = 'ENTRY_PAYMENT_PENDING';

export class SeasonRequestError extends Error {
  readonly kind: SeasonRequestErrorKind;
  readonly statusCode?: number;
  readonly code?: string;
  readonly traceId?: string;

  constructor(
    message: string,
    kind: SeasonRequestErrorKind,
    statusCode?: number,
    code?: string,
    traceId?: string
  ) {
    super(message);
    this.name = 'SeasonRequestError';
    this.kind = kind;
    this.statusCode = statusCode;
    this.code = code;
    this.traceId = traceId;
  }
}
