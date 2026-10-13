import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/entities/session';
import { useJoinSeasonMutation } from '../api/seasons.mutations';
import { seasonQueryKeys } from '../api/seasons.queries';
import type { Season } from '../api/seasons.types';
import { getSeasonErrorKey, type SeasonErrorKey } from '../lib/seasonErrors';
import { getEntryPayer } from './seasonEntryPayer';
import type { useSeasonSessionScope } from './useSeasonSessionScope';

/** 상세의 참가 버튼 뒤에 띄우는 안내 팝업. 지갑 안내는 손님의 시즌 개설 시도에도 쓴다. */
export type SeasonJoinNotice =
  | { kind: 'wallet'; action?: 'create' }
  | { kind: 'fee'; season: Season }
  | { kind: 'full' }
  | { kind: 'joined'; seasonId: string }
  | { kind: 'error'; season: Season; error: SeasonErrorKey; payment: boolean };

const paymentFailure = new Set<SeasonErrorKey>([
  'walletSigning',
  'paymentExpired',
  'paymentFailed',
]);

/** 참가 실패를 정원 초과·결제 실패·일반 실패 팝업 중 하나로 나눈다. */
export function joinFailureNotice(season: Season, error: SeasonErrorKey): SeasonJoinNotice {
  return error === 'capacityReached'
    ? { kind: 'full' }
    : { kind: 'error', season, error, payment: paymentFailure.has(error) };
}

/** 목록 상세에서 참가를 요청하고 지갑 연결·정원 초과·참가 완료·실패 팝업으로 이어 준다. */
export function useSeasonJoinFlow(
  scope: ReturnType<typeof useSeasonSessionScope>,
  onNotice: () => void
) {
  const mutation = useJoinSeasonMutation(scope.isCurrentScope);
  const queryClient = useQueryClient();
  const requestRef = useRef<object | null>(null);
  const [noticeState, setNoticeState] = useState<{
    version: number;
    value: SeasonJoinNotice;
  } | null>(null);
  const [joiningState, setJoiningState] = useState<{ version: number; id: string } | null>(null);
  // 계정이 바뀌면 이전 계정의 팝업과 진행 표시를 render 시점부터 숨긴다.
  const notice = noticeState?.version === scope.resetVersion ? noticeState.value : null;
  const joiningId = joiningState?.version === scope.resetVersion ? joiningState.id : null;

  useEffect(() => {
    // 계정이 바뀌면 진행 중이던 이전 요청의 결과를 버린다.
    requestRef.current = null;
  }, [scope.resetVersion]);

  // 팝업은 상세 모달을 대신하므로 상세를 닫은 뒤 표시한다.
  const show = (value: SeasonJoinNotice) => {
    onNotice();
    setNoticeState({ version: scope.resetVersion, value });
  };

  function isFull(season: Season) {
    return (
      !season.isParticipant &&
      season.capacity !== null &&
      season.participantCount >= season.capacity
    );
  }

  async function confirmPayment(season: Season) {
    if (!scope.session) return show({ kind: 'wallet' });
    if (isFull(season)) return show({ kind: 'full' });
    const token = scope.captureScope();
    if (!token || requestRef.current) return;
    // 유료 참가는 결제 중 문구를 입장료 팝업에 유지한다.
    if (season.entryFeeLamports !== '0') {
      setNoticeState({ version: scope.resetVersion, value: { kind: 'fee', season } });
    }
    const request = {};
    requestRef.current = request;
    setJoiningState({ version: scope.resetVersion, id: season.id });
    try {
      const joined = await mutation.mutateAsync({
        id: season.id,
        scope: token,
        payerWalletAddress: getEntryPayer(season, scope.session),
      });
      // 늦게 도착한 이전 계정의 응답은 현재 화면에 팝업을 띄우지 않는다.
      if (!scope.isCurrentScope(token) || requestRef.current !== request) return;
      show({ kind: 'joined', seasonId: joined.id });
    } catch (cause) {
      if (!scope.isCurrentScope(token) || requestRef.current !== request) return;
      const error = getSeasonErrorKey(cause);
      show(joinFailureNotice(season, error));
      if (error === 'sessionInvalid' || error === 'userUnavailable') {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
      // 정원과 상태는 서버가 판단하므로 실패 뒤 최신 상세와 목록을 다시 받는다.
      void queryClient.invalidateQueries({
        queryKey: seasonQueryKeys.detail(token.sessionKey, season.id),
      });
      void queryClient.invalidateQueries({ queryKey: seasonQueryKeys.lists(token.sessionKey) });
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setJoiningState(null);
      }
    }
  }

  async function join(season: Season) {
    if (!scope.session) return show({ kind: 'wallet' });
    // 정원은 서버가 최종 판단하지만, 이미 가득 찬 상세에서는 요청 없이 안내한다.
    if (isFull(season)) return show({ kind: 'full' });
    // 유료 참가는 결제를 시작하기 전에 입장료 확인 팝업을 연다.
    if (season.entryFeeLamports !== '0' && !season.isParticipant) {
      return show({ kind: 'fee', season });
    }
    return confirmPayment(season);
  }

  return {
    notice,
    joiningId,
    join,
    confirmPayment,
    askWalletToCreate: () => show({ kind: 'wallet', action: 'create' }),
    closeNotice: () => setNoticeState(null),
  };
}
