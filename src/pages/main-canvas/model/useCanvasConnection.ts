import { useCallback, useEffect, useRef, useState } from 'react';
import { initialCanvasConnection, openCanvasConnection } from './canvasConnection';

export function useCanvasConnection() {
  const [connection, setConnection] = useState(initialCanvasConnection);
  const ownerRef = useRef<ReturnType<typeof openCanvasConnection> | null>(null);

  useEffect(() => {
    // render에서는 소켓을 만들지 않는다. 마운트한 페이지가 연결 하나의 수명을 소유한다.
    const owner = openCanvasConnection(setConnection);
    ownerRef.current = owner;
    return () => {
      ownerRef.current = null;
      owner.dispose();
    };
  }, []);

  const retry = useCallback(() => ownerRef.current?.retry(), []);
  return { connection, retry };
}
