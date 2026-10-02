import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { sessionMutationKey, sessionQueryKey, type AuthenticatedSession } from '@/entities/session';
import { authenticateWallet, logout, setDisplayName } from './wallet-auth.api';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: sessionMutationKey,
    mutationFn: authenticateWallet,
    retry: false,
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onSuccess: async ({ user, session }) => {
      await queryClient.cancelQueries({ queryKey: sessionQueryKey });
      queryClient.setQueryData<AuthenticatedSession>(sessionQueryKey, { user, session });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: sessionMutationKey,
    mutationFn: logout,
    retry: false,
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: sessionQueryKey });
      queryClient.setQueryData(sessionQueryKey, null);
    },
  });
}

export function useDisplayNameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: sessionMutationKey,
    mutationFn: setDisplayName,
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
      if (isAxiosError(error)) {
        const response = error.response;
        if (
          response?.status === 401 ||
          (response?.status === 403 && response.data?.code === 'AUTH_USER_UNAVAILABLE')
        ) {
          queryClient.setQueryData(sessionQueryKey, null);
        }
      }
    },
  });
}
