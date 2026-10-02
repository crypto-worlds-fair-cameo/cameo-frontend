import { useIsMutating, useQuery } from '@tanstack/react-query';
import { getSession } from './session.api';

export const sessionQueryKey = ['auth', 'session'] as const;
export const sessionMutationKey = ['auth', 'session-change'] as const;

export function useSessionQuery() {
  const isChangingSession = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => getSession(signal),
    enabled: !isChangingSession,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
