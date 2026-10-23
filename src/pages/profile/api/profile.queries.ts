import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { sessionMutationKey, sessionQueryKey, type AuthenticatedSession } from '@/entities/session';
import {
  getHostedSeasons,
  getParticipatedSeasons,
  getTransactions,
  getWalletBalance,
  updateDisplayName,
  uploadProfileImage,
} from './profile.api';

export const profileQueryKeys = {
  participated: (userId: string) => ['profile', 'participated', userId] as const,
  hosted: (userId: string) => ['profile', 'hosted', userId] as const,
  balance: (walletAddress: string) => ['profile', 'balance', walletAddress] as const,
  transactions: (userId: string) => ['profile', 'transactions', userId] as const,
};

function isVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** 참여 시즌은 한 번에 20개씩 읽고 보이는 탭에서 목록 summary를 30초마다 갱신한다. */
export function useParticipatedSeasonsQuery(userId: string) {
  return useInfiniteQuery({
    queryKey: profileQueryKeys.participated(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => getParticipatedSeasons(20, pageParam, signal),
    getNextPageParam: page => {
      const nextOffset = page.offset + page.limit;
      return nextOffset < page.total ? nextOffset : undefined;
    },
    retry: failureCount => failureCount < 2,
    refetchOnWindowFocus: true,
    refetchInterval: () => (isVisible() ? 30_000 : false),
  });
}

/** 내가 만든 시즌도 20개씩 읽고, 시작·종료 시각이 지나 바뀐 상태와 참여자 수를 30초마다 갱신한다. */
export function useHostedSeasonsQuery(userId: string) {
  return useInfiniteQuery({
    queryKey: profileQueryKeys.hosted(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => getHostedSeasons(20, pageParam, signal),
    getNextPageParam: page => {
      const nextOffset = page.offset + page.limit;
      return nextOffset < page.total ? nextOffset : undefined;
    },
    retry: failureCount => failureCount < 2,
    refetchOnWindowFocus: true,
    refetchInterval: () => (isVisible() ? 30_000 : false),
  });
}

/** 잔액은 서버를 거쳐 RPC를 호출하므로 탭이 보일 때만 1분마다 갱신한다. */
export function useWalletBalanceQuery(walletAddress: string) {
  return useQuery({
    queryKey: profileQueryKeys.balance(walletAddress),
    queryFn: ({ signal }) => getWalletBalance(signal),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: () => (isVisible() ? 60_000 : false),
  });
}

export function useTransactionsQuery(userId: string) {
  return useInfiniteQuery({
    queryKey: profileQueryKeys.transactions(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => getTransactions(20, pageParam, signal),
    getNextPageParam: page => {
      const nextOffset = page.offset + page.limit;
      return nextOffset < page.total ? nextOffset : undefined;
    },
    retry: failureCount => failureCount < 2,
    refetchOnWindowFocus: true,
  });
}

export interface ProfileChanges {
  displayName?: string;
  image?: File;
}

/**
 * 수정 모달의 바뀐 닉네임과 사진을 차례로 저장한다. 헤더의 신규 사용자 닉네임 저장과 같은
 * 세션 변경 key를 사용해 중복 저장과 세션 조회 경쟁을 막는다. 단계마다 같은 사용자의 세션 캐시를
 * 갱신하므로, 사진 저장이 실패해도 먼저 저장된 닉네임은 헤더와 프로필에 바로 반영된다.
 */
export function useSaveProfileMutation() {
  const queryClient = useQueryClient();

  async function updateSessionUser(
    userId: string,
    changes: Partial<Pick<AuthenticatedSession['user'], 'displayName' | 'avatarUrl'>>
  ) {
    await queryClient.cancelQueries({ queryKey: sessionQueryKey });
    queryClient.setQueryData<AuthenticatedSession | null>(sessionQueryKey, session =>
      session?.user.id === userId ? { ...session, user: { ...session.user, ...changes } } : session
    );
  }

  return useMutation({
    mutationKey: sessionMutationKey,
    mutationFn: async ({ displayName, image }: ProfileChanges) => {
      if (displayName !== undefined) {
        const profile = await updateDisplayName(displayName);
        await updateSessionUser(profile.id, { displayName: profile.displayName });
      }
      if (image) {
        const profile = await uploadProfileImage(image);
        await updateSessionUser(profile.id, { avatarUrl: profile.avatarUrl });
      }
    },
    retry: false,
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onError: error => {
      // 서버가 세션을 인정하지 않으면 로그인 상태를 지워 미로그인 화면으로 전환한다.
      const response = isAxiosError(error) ? error.response : undefined;
      if (
        response?.status === 401 ||
        (response?.status === 403 && response.data?.code === 'AUTH_USER_UNAVAILABLE')
      ) {
        queryClient.setQueryData(sessionQueryKey, null);
      }
    },
  });
}
