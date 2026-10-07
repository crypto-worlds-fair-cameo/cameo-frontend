import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSessionQuery } from '@/entities/session';
import type { CanvasKey } from '../api/canvasProtocol';
import {
  initialCanvasConnection,
  openCanvasConnection,
  type CanvasConnectionHandlers,
} from './canvasConnection';

/** 페이지 연결 하나를 소유하며 세션 변경 시 새 쿠키로 권한을 다시 확인한다. */
export function useCanvasConnection(
  handlers: CanvasConnectionHandlers = {},
  canvasKey: CanvasKey = 'main',
  reconnectVersion = 0,
  enabled = true
) {
  const sessionQuery = useSessionQuery();
  const session = sessionQuery.data;
  // 갱신되는 만료 기한은 제외하고 로그인 사용자와 절대 만료 기한으로 세션 교체를 구분한다.
  const sessionKey =
    session === undefined
      ? undefined
      : session === null
        ? 'guest'
        : JSON.stringify([session.user.id, session.session.absoluteExpiresAt]);
  const [connection, setConnection] = useState(initialCanvasConnection);
  const ownerRef = useRef<ReturnType<typeof openCanvasConnection> | null>(null);
  const handlersRef = useRef(handlers);
  const sessionKeyRef = useRef(sessionKey);
  const initialSessionFailedRef = useRef(false);
  const openedSessionKeyRef = useRef(sessionKey);
  useLayoutEffect(() => {
    // commit된 페이지 콜백으로 교체하고 소켓 수명은 유지한다.
    handlersRef.current = handlers;
  }, [handlers]);

  /** 최신 페이지 콜백만 읽어 콜백 identity 변경으로 transport가 다시 열리지 않게 한다. */
  const startRef = useRef(() =>
    openCanvasConnection(
      setConnection,
      {
        onReady: (socket, ready) => handlersRef.current.onReady?.(socket, ready),
        onInterrupted: () => handlersRef.current.onInterrupted?.(),
        onPreview: payload => handlersRef.current.onPreview?.(payload),
        onSeasonState: payload => handlersRef.current.onSeasonState?.(payload),
      },
      canvasKey
    )
  );

  useLayoutEffect(() => {
    startRef.current = () => {
      openedSessionKeyRef.current = sessionKey;
      return openCanvasConnection(
        setConnection,
        {
          onReady: (socket, ready) => handlersRef.current.onReady?.(socket, ready),
          onInterrupted: () => handlersRef.current.onInterrupted?.(),
          onPreview: payload => handlersRef.current.onPreview?.(payload),
          onSeasonState: payload => handlersRef.current.onSeasonState?.(payload),
        },
        canvasKey
      );
    };
  }, [canvasKey, sessionKey]);

  useEffect(() => {
    // 최초 조회 중에도 쿠키를 전달해 접속하고 페이지가 소켓 수명을 소유한다.
    if (!enabled) return;
    ownerRef.current = startRef.current();
    return () => {
      // ref를 먼저 비우고 이전 연결의 이벤트, 비동기 작업과 예약을 정리한다.
      const owner = ownerRef.current;
      ownerRef.current = null;
      owner?.dispose();
    };
  }, [canvasKey, reconnectVersion, enabled]);

  useEffect(() => {
    // 첫 HTTP 조회 결과는 최초 소켓과 같은 쿠키를 쓰므로 baseline만 기록한다.
    // 조회 중 상태나 동일 세션 갱신은 현재 연결을 유지한다.
    if (sessionKey === undefined) {
      // 최초 조회가 실패하면 이후 로그인 결과는 최초 handshake와 다른 쿠키를 가진다.
      if (sessionQuery.isError) initialSessionFailedRef.current = true;
      return;
    }
    const previous = sessionKeyRef.current;
    sessionKeyRef.current = sessionKey;
    const authenticatedAfterInitialFailure =
      previous === undefined && initialSessionFailedRef.current && session !== null;
    initialSessionFailedRef.current = false;
    if ((!authenticatedAfterInitialFailure && previous === undefined) || previous === sessionKey)
      return;
    // 대상·활성 상태 변경 effect가 이미 새 세션 연결을 만들었으면 중복 생성하지 않는다.
    if (!enabled || openedSessionKeyRef.current === sessionKey) return;
    // 로그인, 로그아웃 또는 새 세션은 이전 권한을 닫고 새 서버 ready를 기다린다.
    ownerRef.current?.dispose();
    setConnection(initialCanvasConnection);
    ownerRef.current = startRef.current();
  }, [sessionKey, sessionQuery.isError, session, enabled]);

  return { connection };
}
