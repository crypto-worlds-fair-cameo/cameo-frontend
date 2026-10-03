import { useCallback, useEffect, useRef, useState } from 'react';
import { initialCanvasConnection, openCanvasConnection } from './canvasConnection';

/** 페이지가 소켓 하나를 소유하고, 최신 연결 상태와 수동 재시도 함수를 UI에 제공한다. */
export function useCanvasConnection() {
  // 서버 이벤트에서 전달받은 상태는 화면용 state에, 연결 제어 객체는 렌더와 무관한 ref에 둔다.
  const [connection, setConnection] = useState(initialCanvasConnection);
  const ownerRef = useRef<ReturnType<typeof openCanvasConnection> | null>(null);

  useEffect(() => {
    // render에서는 소켓을 만들지 않는다. 마운트한 페이지가 연결 하나의 수명을 소유한다.
    // 컨트롤러가 이벤트를 연결 상태로 바꾸면 setConnection을 통해 페이지와 상태 UI에 전달한다.
    const owner = openCanvasConnection(setConnection);
    ownerRef.current = owner;
    return () => {
      // 이전 연결을 다시 호출하지 않도록 ref부터 비우고, 소켓·리스너·모든 타이머를 정리한다.
      ownerRef.current = null;
      owner.dispose();
    };
  }, []);

  // 현재 연결 제어 객체가 있으면 재시도를 요청하고, 마운트 전이나 정리 후에는 아무 일도 하지 않는다.
  const retry = useCallback(() => ownerRef.current?.retry(), []);
  return { connection, retry };
}
