import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sessionMutationKey,
  sessionQueryKey,
  useSessionQuery,
  type AuthenticatedSession,
} from '@/entities/session';
import { signSolanaTransaction } from '@/shared/lib/solana-wallet/sign-transaction';
import { useTransactionSigningSupport } from '@/shared/lib/solana-wallet/use-transaction-signing-support';
import { createClaimAttempt, getSeasonNft, submitClaimTransaction } from '../api/season-nft.api';
import {
  claimQueryKeys,
  useClaimAttemptQuery,
  useSeasonNftStatusQuery,
} from '../api/season-nft.queries';
import {
  isSessionInvalidError,
  SeasonNftRequestError,
  type SeasonNftNetwork,
  type SeasonNftSummary,
} from '../api/season-nft.types';

export interface UseSeasonNftClaimInput {
  seasonId: string;
  source: 'detail' | 'workspace' | 'profile';
  initialSummary?: SeasonNftSummary;
}

export type LocalSignatureError = 'CANCELLED' | 'REQUEST_PENDING' | 'ACCOUNT_CHANGED' | 'FAILED';

function sessionIdentity(session: AuthenticatedSession | null | undefined, seasonId: string) {
  return session
    ? `${session.user.id}:${session.activeWallet.id}:${session.activeWallet.address}:${seasonId}`
    : `signed-out:${seasonId}`;
}

function signatureError(error: unknown): LocalSignatureError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (Number(error.code) === 4001) return 'CANCELLED';
    if (Number(error.code) === -32002) return 'REQUEST_PENDING';
    if (String(error.code) === 'ACCOUNT_NOT_FOUND' || String(error.code) === 'ACCOUNT_AMBIGUOUS') {
      return 'ACCOUNT_CHANGED';
    }
  }
  return 'FAILED';
}

interface ScopeIdentity {
  key: string;
  sessionIdentity: string;
}

interface ScopeToken {
  scope: ScopeIdentity;
  sessionMutationEpoch: number;
}

interface LocalAttempt {
  id: string;
  statusUpdateCount: number;
}

function isSessionMutationKey(key: readonly unknown[] | undefined) {
  return (
    key?.length === sessionMutationKey.length &&
    key.every((part, index) => part === sessionMutationKey[index])
  );
}

/**
 * 세션·지갑·시즌·네트워크에 귀속된 수령 흐름을 조합한다.
 * 지갑 또는 서버 응답이 늦게 돌아오면 현재 화면 범위를 다시 확인한 뒤 이전 결과를 폐기한다.
 */
export function useSeasonNftClaim(input: UseSeasonNftClaimInput) {
  const sessionQuery = useSessionQuery();
  const queryClient = useQueryClient();
  const isChangingSession = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  const session = isChangingSession ? undefined : sessionQuery.data;
  const [engaged, setEngaged] = useState(false);
  const [localAttempt, setLocalAttempt] = useState<LocalAttempt | null>(null);
  const [localSignatureError, setLocalSignatureError] = useState<LocalSignatureError | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<unknown>(null);
  const [isWalletSigning, setIsWalletSigning] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingError, setIsRefreshingError] = useState(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const signingPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const sessionMutationEpochRef = useRef(0);
  const previousIdentityRef = useRef(sessionIdentity(session, input.seasonId));
  const userId = session?.user.id ?? 'signed-out';
  const summaryAttemptId = input.initialSummary?.claim.activeAttemptId ?? null;
  const detailEnabled =
    Boolean(session) &&
    (input.source !== 'profile' || engaged || localAttempt !== null || summaryAttemptId !== null);
  const statusQuery = useSeasonNftStatusQuery(userId, input.seasonId, detailEnabled);
  const view = statusQuery.data ?? input.initialSummary;
  const network: SeasonNftNetwork = view?.network ?? 'devnet';
  const statusQueryKey = claimQueryKeys.status(userId, input.seasonId);
  const statusUpdateCount = queryClient.getQueryState(statusQueryKey)?.dataUpdateCount ?? 0;
  const localAttemptPendingPropagation =
    localAttempt !== null && statusUpdateCount <= localAttempt.statusUpdateCount;
  const authoritativeAttemptId =
    statusQuery.data === undefined
      ? (input.initialSummary?.claim.activeAttemptId ?? null)
      : statusQuery.data.claim.activeAttemptId;
  const attemptId = localAttemptPendingPropagation ? localAttempt.id : authoritativeAttemptId;
  const attemptQuery = useClaimAttemptQuery(
    userId,
    network,
    input.seasonId,
    attemptId ?? 'none',
    Boolean(session && attemptId)
  );
  const attempt = attemptQuery.data;

  const createMutation = useMutation({
    mutationFn: () => createClaimAttempt(input.seasonId),
    retry: 0,
  });

  const observedSupport = useTransactionSigningSupport(
    session?.activeWallet.address ?? '',
    network
  );
  const support =
    !session ||
    (view?.claim.walletAddress && view.claim.walletAddress !== session.activeWallet.address)
      ? ({ supported: false, reason: 'ACCOUNT_NOT_FOUND' } as const)
      : observedSupport;

  const identity = sessionIdentity(session, input.seasonId);
  const scopeKey = `${identity}:${network}`;
  const scopeIdentity = useMemo<ScopeIdentity>(
    () => ({ key: scopeKey, sessionIdentity: identity }),
    [identity, scopeKey]
  );
  const scopeRef = useRef(scopeIdentity);
  useLayoutEffect(() => {
    // commit 직후 현재 범위를 교체해 이전 비동기 결과가 submit 전에 통과하지 못하게 한다.
    scopeRef.current = scopeIdentity;
  }, [scopeIdentity]);
  const captureScope = (): ScopeToken => ({
    scope: scopeIdentity,
    sessionMutationEpoch: sessionMutationEpochRef.current,
  });
  const isScopeCurrent = (token: ScopeToken) => {
    const cachedSession = queryClient.getQueryData<AuthenticatedSession | null>(sessionQueryKey);
    return (
      mountedRef.current &&
      scopeRef.current === token.scope &&
      sessionMutationEpochRef.current === token.sessionMutationEpoch &&
      queryClient.isMutating({ mutationKey: sessionMutationKey }) === 0 &&
      sessionIdentity(cachedSession, input.seasonId) === token.scope.sessionIdentity
    );
  };

  useEffect(() => {
    // mutation 시작 이벤트에서 epoch를 올려 React 재렌더보다 먼저 대기 중인 서명을 무효화한다.
    return queryClient.getMutationCache().subscribe(event => {
      if (
        event.type === 'updated' &&
        event.action.type === 'pending' &&
        isSessionMutationKey(event.mutation.options.mutationKey)
      ) {
        sessionMutationEpochRef.current += 1;
        // React가 새 세션을 render하기 전에 이전 세대의 pending poll과 retained 오류를 함께 제거한다.
        void queryClient.cancelQueries({ queryKey: claimQueryKeys.root });
        queryClient.removeQueries({ queryKey: claimQueryKeys.root });
      }
    });
  }, [queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const identity = sessionIdentity(session, input.seasonId);
    if (identity === previousIdentityRef.current) return;
    previousIdentityRef.current = identity;
    // 새 세션·지갑은 이전 화면의 시도와 로컬 오류를 이어받지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 세션 범위가 바뀌면 이전 비동기 UI 상태를 즉시 폐기해야 한다.
    setEngaged(false);
    setLocalAttempt(null);
    setLocalSignatureError(null);
    setStartError(null);
    setSubmitError(null);
    setIsStarting(false);
    setIsWalletSigning(false);
    setIsSubmitting(false);
    setIsRefreshingError(false);
    createMutation.reset();
  }, [createMutation, input.seasonId, session]);

  useEffect(() => {
    if (!localAttempt || statusUpdateCount <= localAttempt.statusUpdateCount) return;
    // 생성 이후 도착한 status가 local attempt와 다르거나 null이어도 서버 값을 우선한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 status가 local 전파 대기 상태를 끝낸다.
    setLocalAttempt(null);
  }, [localAttempt, statusUpdateCount]);

  const pollingAuthError = isSessionInvalidError(statusQuery.error)
    ? statusQuery.error
    : isSessionInvalidError(attemptQuery.error)
      ? attemptQuery.error
      : null;
  useLayoutEffect(() => {
    if (!pollingAuthError || !session) return;
    const cachedSession = queryClient.getQueryData<AuthenticatedSession | null>(sessionQueryKey);
    // 이전 사용자의 늦은 오류는 새 세션을 지우지 않고, 현재 범위 오류만 즉시 폐기한다.
    if (
      sessionIdentity(cachedSession, input.seasonId) !== sessionIdentity(session, input.seasonId)
    ) {
      return;
    }
    sessionMutationEpochRef.current += 1;
    // 이 세션 세대의 auth 오류와 데이터를 함께 제거해 같은 지갑의 재로그인이 오류를 상속하지 않는다.
    void queryClient.cancelQueries({ queryKey: claimQueryKeys.user(session.user.id) });
    queryClient.removeQueries({ queryKey: claimQueryKeys.user(session.user.id) });
    queryClient.setQueryData(sessionQueryKey, null);
  }, [input.seasonId, pollingAuthError, queryClient, session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 새 거래는 이전 거래의 서명·제출 오류를 상속하지 않는다.
    setLocalSignatureError(null);
    setSubmitError(null);
  }, [attempt?.transaction?.transactionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 체인 범위 변경 시 이전 체인의 진행 표시를 폐기한다.
    setIsWalletSigning(false);
    setIsSubmitting(false);
    setIsRefreshingError(false);
    setSubmitError(null);
  }, [network]);

  const previousNetworkRef = useRef<SeasonNftNetwork | null>(null);
  useEffect(() => {
    const previous = previousNetworkRef.current;
    previousNetworkRef.current = network;
    if (!session || previous === null || previous === network || !statusQuery.data) return;
    // 환경이 바뀌면 이전 환경 attempt를 제거하고 현재 status 응답만 다시 심는다.
    void queryClient.cancelQueries({ queryKey: claimQueryKeys.user(session.user.id) }).then(() => {
      queryClient.removeQueries({ queryKey: claimQueryKeys.user(session.user.id) });
      queryClient.setQueryData(
        claimQueryKeys.status(session.user.id, input.seasonId),
        statusQuery.data
      );
    });
  }, [input.seasonId, network, queryClient, session, statusQuery.data]);

  const completionKey =
    view?.claim.state === 'CLAIMED' || attempt?.state === 'SUCCEEDED'
      ? `${userId}:${input.seasonId}:${view?.claim.state}:${attempt?.state}`
      : null;
  const invalidatedCompletionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!completionKey || invalidatedCompletionRef.current === completionKey || !session) return;
    invalidatedCompletionRef.current = completionKey;
    // 세 진입점이 같은 결과를 읽도록 NFT, 시즌 상세, 참여 목록을 함께 갱신한다.
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: claimQueryKeys.status(userId, input.seasonId) }),
      queryClient.invalidateQueries({ queryKey: ['season-canvas'] }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'participated', userId] }),
    ]);
  }, [completionKey, input.seasonId, queryClient, session, userId]);

  function startClaim(): Promise<void> {
    if (startPromiseRef.current) return startPromiseRef.current;
    // 세션 mutation이 render보다 먼저 시작됐으면 stale session으로 새 claim을 열지 않는다.
    if (!session || queryClient.isMutating({ mutationKey: sessionMutationKey }) > 0) {
      return Promise.resolve();
    }
    const token = captureScope();
    const currentSeasonId = input.seasonId;
    const currentUserId = session.user.id;
    setEngaged(true);
    setLocalSignatureError(null);
    setStartError(null);
    setSubmitError(null);
    setIsStarting(true);

    const promise = (async () => {
      try {
        // 프로필 summary를 신뢰해 POST하지 않고 전체 상세를 먼저 검증한다.
        const fresh = await getSeasonNft(currentSeasonId);
        if (!isScopeCurrent(token)) return;
        queryClient.setQueryData(claimQueryKeys.status(currentUserId, currentSeasonId), fresh);
        const created = await createMutation.mutateAsync();
        if (!isScopeCurrent(token)) return;
        if (created.attemptId) {
          // 생성 전에 시작한 status 요청을 먼저 폐기해 늦은 null/old ID가 새 attempt를 지우지 않게 한다.
          await queryClient.cancelQueries({ queryKey: statusQueryKey, exact: true });
          if (!isScopeCurrent(token)) return;
          const currentUpdateCount =
            queryClient.getQueryState(statusQueryKey)?.dataUpdateCount ?? 0;
          setLocalAttempt({ id: created.attemptId, statusUpdateCount: currentUpdateCount });
        }
        if (created.state === 'CLAIMED') {
          await queryClient.invalidateQueries({
            queryKey: claimQueryKeys.status(currentUserId, currentSeasonId),
          });
        }
      } catch (error) {
        if (!isScopeCurrent(token)) return;
        if (isSessionInvalidError(error)) {
          sessionMutationEpochRef.current += 1;
          queryClient.setQueryData(sessionQueryKey, null);
          return;
        }
        setStartError(error);
      }
    })().finally(() => {
      if (startPromiseRef.current === promise) {
        startPromiseRef.current = null;
        if (mountedRef.current) setIsStarting(false);
      }
    });
    startPromiseRef.current = promise;
    return promise;
  }

  function sign(): Promise<void> {
    if (signingPromiseRef.current) return signingPromiseRef.current;
    const transaction = attempt?.transaction;
    if (
      !session ||
      queryClient.isMutating({ mutationKey: sessionMutationKey }) > 0 ||
      !attemptId ||
      attempt?.state !== 'AWAITING_SIGNATURE' ||
      !transaction ||
      !support.supported
    ) {
      return Promise.resolve();
    }
    const token = captureScope();
    const currentSeasonId = input.seasonId;
    const currentAttemptId = attemptId;
    const expectedNetwork = attempt.network;
    setLocalSignatureError(null);
    setSubmitError(null);
    setIsWalletSigning(true);

    const promise = (async () => {
      try {
        const signedTransactionBase64 = await signSolanaTransaction({
          walletAddress: session.activeWallet.address,
          network: expectedNetwork,
          serializedTransactionBase64: transaction.serializedTransactionBase64,
        });
        // 로그아웃·지갑·시즌·네트워크 변경 뒤 돌아온 bytes는 메모리에서 버리고 POST하지 않는다.
        if (!isScopeCurrent(token)) return;
        setIsSubmitting(true);
        await submitClaimTransaction(currentSeasonId, currentAttemptId, {
          transactionId: transaction.transactionId,
          signedTransactionBase64,
        });
        if (!isScopeCurrent(token)) return;
        await Promise.all([attemptQuery.refetch(), statusQuery.refetch()]);
      } catch (error) {
        if (!isScopeCurrent(token)) return;
        if (isSessionInvalidError(error)) {
          sessionMutationEpochRef.current += 1;
          queryClient.setQueryData(sessionQueryKey, null);
          return;
        }
        if (error instanceof SeasonNftRequestError) setSubmitError(error);
        else setLocalSignatureError(signatureError(error));
      } finally {
        if (mountedRef.current && isScopeCurrent(token)) setIsSubmitting(false);
      }
    })().finally(() => {
      if (signingPromiseRef.current === promise) {
        signingPromiseRef.current = null;
        if (mountedRef.current) setIsWalletSigning(false);
      }
    });
    signingPromiseRef.current = promise;
    return promise;
  }

  async function refreshAfterError() {
    const token = captureScope();
    setIsRefreshingError(true);
    try {
      const refreshes: Array<Promise<{ isError: boolean }>> = [statusQuery.refetch()];
      if (attemptId) refreshes.push(attemptQuery.refetch());
      const results = await Promise.all(refreshes);
      if (!isScopeCurrent(token) || results.some(result => result.isError)) return;
      // 서버 상태를 다시 읽은 경우에만 불확실성 gate를 해제해 재서명을 허용한다.
      setStartError(null);
      setSubmitError(null);
      setLocalSignatureError(null);
    } finally {
      if (mountedRef.current && isScopeCurrent(token)) setIsRefreshingError(false);
    }
  }

  return {
    session,
    view,
    statusQuery,
    attempt,
    attemptQuery,
    support,
    signatureError: localSignatureError,
    isStarting,
    isSigning: isWalletSigning || isSubmitting,
    isRefreshingError,
    startError,
    submitError,
    startClaim,
    sign,
    refreshAfterError,
  };
}
