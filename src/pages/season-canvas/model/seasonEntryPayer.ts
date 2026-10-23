import type { AuthenticatedSession } from '@/entities/session';
import type { Season } from '../api/seasons.types';

/** 유료 시즌의 신규 참가자만 현재 로그인 지갑으로 입장료를 결제한다. */
export function getEntryPayer(
  season: Season,
  session: AuthenticatedSession | null | undefined
): string | undefined {
  if (season.isParticipant || season.entryFeeLamports === '0') return undefined;
  return session?.activeWallet?.address;
}
