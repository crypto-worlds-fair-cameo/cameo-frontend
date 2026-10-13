import { useState } from 'react';
import type { Season } from '../api/seasons.types';
import { joinFailureNotice, type SeasonJoinNotice } from './useSeasonJoinFlow';
import type { useSeasonWorkspace } from './useSeasonWorkspace';

/** 방 안의 참가 버튼도 목록 상세와 같은 입장료 확인·참가 완료·실패 팝업을 거치게 한다. */
export function useSeasonRoomJoin({
  scope,
  season,
  join,
}: Pick<ReturnType<typeof useSeasonWorkspace>, 'scope' | 'season' | 'join'>) {
  const [noticeState, setNoticeState] = useState<{
    version: number;
    value: SeasonJoinNotice;
  } | null>(null);
  // 계정이 바뀌면 이전 계정의 팝업을 render 시점부터 숨긴다.
  const notice =
    noticeState !== null && noticeState.version === scope.resetVersion ? noticeState.value : null;
  const show = (value: SeasonJoinNotice) => setNoticeState({ version: scope.resetVersion, value });

  async function pay(target: Season) {
    // 유료 참가는 결제 중 문구를 입장료 팝업에 유지한다.
    if (target.entryFeeLamports !== '0') show({ kind: 'fee', season: target });
    const result = await join.join(target);
    if (!result) return;
    show(
      result.status === 'joined'
        ? { kind: 'joined', seasonId: target.id }
        : joinFailureNotice(target, result.error)
    );
  }

  return {
    notice,
    // 참가 요청은 이 방의 시즌에만 보낸다.
    joiningId: join.isJoining ? (season?.id ?? null) : null,
    open(target: Season) {
      // 유료 참가는 결제를 시작하기 전에 입장료 확인 팝업을 연다.
      if (target.entryFeeLamports !== '0') show({ kind: 'fee', season: target });
      else void pay(target);
    },
    pay,
    close: () => setNoticeState(null),
  };
}
