import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionMutationKey, sessionQueryKey } from '@/entities/session';
import { authenticateWallet, logout } from './wallet-auth.api';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: sessionMutationKey,
    mutationFn: authenticateWallet,
    retry: false,
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onSuccess: async session => {
      await queryClient.cancelQueries({ queryKey: sessionQueryKey });
      queryClient.setQueryData(sessionQueryKey, session);
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
