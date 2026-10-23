import { signSolanaTransaction } from '@/shared/lib/solana-wallet/sign-transaction';
import {
  getSeasonEntryPayment,
  joinSeason,
  prepareSeasonEntryPayment,
  submitSeasonEntryTransaction,
} from './seasons.api';
import {
  ENTRY_PAYMENT_PENDING,
  SeasonRequestError,
  WALLET_SIGNING_FAILED,
  type Season,
  type SeasonEntryPayment,
} from './seasons.types';

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function terminalError(payment: SeasonEntryPayment): SeasonRequestError {
  return payment.status === 'EXPIRED'
    ? new SeasonRequestError(
        'The payment request expired.',
        'business',
        409,
        'SEASON_ENTRY_PAYMENT_EXPIRED'
      )
    : new SeasonRequestError(
        'The entry fee transaction failed.',
        'business',
        409,
        'SEASON_ENTRY_PAYMENT_FAILED'
      );
}

/** 입장료를 개설자 지갑으로 보내는 거래에 서명하고 체인 확정 뒤 최신 참가 상세를 받는다. */
export async function payAndJoinSeason(seasonId: string, walletAddress: string): Promise<Season> {
  let payment: SeasonEntryPayment;
  try {
    payment = await prepareSeasonEntryPayment(seasonId);
  } catch (error) {
    // 이전 결제가 이미 확정돼 참가자가 됐으면 결제 없이 최신 참가 상세를 받는다.
    if (error instanceof SeasonRequestError && error.code === 'SEASON_ENTRY_FEE_NOT_REQUIRED') {
      return joinSeason(seasonId);
    }
    throw error;
  }
  if (payment.status === 'AWAITING_SIGNATURE') {
    if (!payment.serializedTransactionBase64) throw terminalError(payment);
    let signed: string;
    try {
      signed = await signSolanaTransaction({
        walletAddress,
        network: payment.network,
        serializedTransactionBase64: payment.serializedTransactionBase64,
      });
    } catch {
      // 지갑 거절·미지원·계정 변경은 서버 결제를 바꾸지 않으므로 같은 결제로 다시 시도할 수 있다.
      throw new SeasonRequestError(
        'The wallet did not sign the entry fee transaction.',
        'business',
        undefined,
        WALLET_SIGNING_FAILED
      );
    }
    payment = await submitSeasonEntryTransaction(seasonId, payment.paymentId, signed);
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (payment.status === 'SUBMITTED') {
    if (Date.now() > deadline) {
      throw new SeasonRequestError(
        'The entry fee transaction is still being confirmed.',
        'business',
        undefined,
        ENTRY_PAYMENT_PENDING
      );
    }
    await wait(POLL_INTERVAL_MS);
    payment = await getSeasonEntryPayment(seasonId, payment.paymentId);
  }
  if (payment.status !== 'CONFIRMED') throw terminalError(payment);
  // 확정된 결제는 서버가 참가를 기록했으므로 참가 API는 기존 참가자의 최신 상세를 돌려준다.
  return joinSeason(seasonId);
}
