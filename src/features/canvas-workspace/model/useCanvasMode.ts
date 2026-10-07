import { useState } from 'react';

export type CanvasMode = 'live' | 'practice';

/** 메인 페이지가 열릴 때 실제 모드로 시작하고, 연습 모드 버튼으로 두 모드를 전환한다. */
export function useCanvasMode() {
  const [mode, setMode] = useState<CanvasMode>('live');

  /** 현재 모드의 반대 모드로 전환한다. 브러시 설정과 소켓 연결은 유지한다. */
  function toggleMode() {
    // 실제 모드에서는 연습 모드로 들어가고, 연습 모드에서는 실제 모드로 돌아간다.
    setMode(current => (current === 'live' ? 'practice' : 'live'));
  }

  return { mode, toggleMode };
}
