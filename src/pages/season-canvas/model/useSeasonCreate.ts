import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/entities/session';
import { useCreateSeasonMutation, type SeasonScopeToken } from '../api/seasons.mutations';
import { seasonQueryKeys } from '../api/seasons.queries';
import type { SeasonFormDraft, SeasonFormErrors } from '../lib/seasonForm';
import { createInitialSeasonDraft, validateSeasonDraft } from '../lib/seasonForm';
import { getSeasonErrorKey, isAmbiguousWriteError, type SeasonErrorKey } from '../lib/seasonErrors';

interface SeasonCreateScope {
  resetVersion: number;
  captureScope: () => SeasonScopeToken | null;
  isCurrentScope: (scope: SeasonScopeToken) => boolean;
}

/** 개설 입력과 한 번의 생성 요청을 소유하며 불명확한 결과의 자동 재전송을 막는다. */
export function useSeasonCreate(
  scope: SeasonCreateScope,
  onCreated: (id: string) => void,
  onCheckList: () => void
) {
  const queryClient = useQueryClient();
  const mutation = useCreateSeasonMutation(scope.isCurrentScope);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SeasonFormDraft>(() => createInitialSeasonDraft());
  const [errors, setErrors] = useState<SeasonFormErrors>({});
  const [serverError, setServerError] = useState<SeasonErrorKey | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);
  const [retryAcknowledged, setRetryAcknowledged] = useState(false);
  const requestOwnerRef = useRef<symbol | null>(null);

  useEffect(() => {
    let active = true;
    // 세션 경계가 바뀐 commit 뒤 입력과 모달을 함께 폐기한다.
    queueMicrotask(() => {
      if (!active) return;
      requestOwnerRef.current = null;
      setOpen(false);
      setDraft(createInitialSeasonDraft());
      setErrors({});
      setServerError(null);
      setTraceId(null);
      setAmbiguous(false);
      setRetryAcknowledged(false);
    });
    return () => {
      active = false;
    };
  }, [scope.resetVersion]);

  const openDialog = () => {
    setDraft(createInitialSeasonDraft());
    setErrors({});
    setServerError(null);
    setTraceId(null);
    setAmbiguous(false);
    setRetryAcknowledged(false);
    setOpen(true);
  };
  const updateDraft = <K extends keyof SeasonFormDraft>(key: K, value: SeasonFormDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setServerError(null);
  };
  const closeDialog = () => {
    if (!requestOwnerRef.current && !mutation.isPending) setOpen(false);
  };

  const submit = async () => {
    if (requestOwnerRef.current || mutation.isPending || (ambiguous && !retryAcknowledged)) return;
    const validation = validateSeasonDraft(draft);
    setErrors(validation.errors);
    if (!validation.input) return;
    const token = scope.captureScope();
    if (!token) return;
    const requestOwner = Symbol('create-season');
    // React가 pending 상태로 다시 그리기 전의 빠른 연속 제출도 한 요청으로 잠근다.
    requestOwnerRef.current = requestOwner;
    setServerError(null);
    setTraceId(null);
    try {
      const season = await mutation.mutateAsync({ input: validation.input, scope: token });
      // 세션이 바뀌었으면 늦은 생성 응답으로 상세를 열지 않는다.
      if (!scope.isCurrentScope(token)) return;
      setOpen(false);
      setAmbiguous(false);
      onCreated(season.id);
    } catch (error) {
      if (!scope.isCurrentScope(token)) return;
      const key = getSeasonErrorKey(error);
      setServerError(key);
      setTraceId(
        typeof error === 'object' && error && 'traceId' in error
          ? String((error as { traceId?: string }).traceId ?? '') || null
          : null
      );
      if (isAmbiguousWriteError(error)) {
        setAmbiguous(true);
        setRetryAcknowledged(false);
      }
      if (key === 'sessionInvalid' || key === 'userUnavailable') {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
    } finally {
      // 이전 요청 완료가 이후 요청의 잠금을 풀지 않도록 요청 소유자를 비교한다.
      if (requestOwnerRef.current === requestOwner) requestOwnerRef.current = null;
    }
  };

  const checkList = () => {
    const token = scope.captureScope();
    // 현재 위치가 이미 전체 1페이지여도 불명확한 생성 결과를 서버에서 다시 확인한다.
    if (token) {
      void queryClient.invalidateQueries({ queryKey: seasonQueryKeys.lists(token.sessionKey) });
    }
    onCheckList();
    setOpen(false);
  };

  return {
    open,
    draft,
    errors,
    serverError,
    traceId,
    ambiguous,
    retryAcknowledged,
    isPending: mutation.isPending,
    openDialog,
    closeDialog,
    updateDraft,
    submit,
    checkList,
    setRetryAcknowledged,
  };
}
