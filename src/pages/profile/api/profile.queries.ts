import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { sessionMutationKey, sessionQueryKey, type AuthenticatedSession } from '@/entities/session';
import { getProfileActivity, updateDisplayName } from './profile.api';

export const profileQueryKeys = {
  activity: (userId: string) => ['profile', 'activity', userId] as const,
};

/** 사용자별 활동을 캐시한다. 다른 계정으로 바뀌면 이전 계정의 목록을 재사용하지 않는다. */
export function useProfileActivityQuery(userId: string) {
  return useQuery({
    queryKey: profileQueryKeys.activity(userId),
    queryFn: getProfileActivity,
  });
}

/**
 * 헤더의 신규 사용자 닉네임 저장과 같은 세션 변경 key를 사용해 중복 저장과 세션 조회 경쟁을 막는다.
 * 저장에 성공하면 같은 사용자의 세션 캐시만 갱신해 헤더와 프로필이 함께 바뀐다.
 */
export function useDisplayNameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: sessionMutationKey,
    mutationFn: updateDisplayName,
    retry: false,
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onSuccess: async profile => {
      await queryClient.cancelQueries({ queryKey: sessionQueryKey });
      queryClient.setQueryData<AuthenticatedSession | null>(sessionQueryKey, session =>
        session?.user.id === profile.id
          ? { ...session, user: { ...session.user, displayName: profile.displayName } }
          : session
      );
    },
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
