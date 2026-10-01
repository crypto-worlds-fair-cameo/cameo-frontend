import { isAxiosError } from 'axios';
import { useIsMutating, useMutationState, useQueryClient } from '@tanstack/react-query';
import { sessionMutationKey, useSessionQuery } from '@/entities/session';
import { useLoginMutation, useLogoutMutation } from '../api/wallet-auth.mutations';
import { disconnectWallet, WalletAuthError } from '../lib/wallet-standard';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';

const errorMessages = {
  WALLET_NOT_FOUND: 'errors.notInstalled',
  WALLET_SIGN_IN_UNSUPPORTED: 'errors.unsupported',
  WALLET_RESPONSE_INVALID: 'errors.invalidWalletResponse',
  AUTH_CHALLENGE_INVALID: 'errors.challengeInvalid',
  AUTH_SIGNATURE_INVALID: 'errors.signatureInvalid',
  AUTH_ORIGIN_NOT_ALLOWED: 'errors.originNotAllowed',
  AUTH_USER_UNAVAILABLE: 'errors.userUnavailable',
  ThrottlerException: 'errors.rateLimited',
} as const;

function getAuthErrorKey(error: unknown) {
  let code: unknown;
  if (error instanceof WalletAuthError) code = error.code;
  else if (isAxiosError(error)) {
    if (!error.response) return 'errors.network' as const;
    code = error.response.data?.code;
    if (error.response.status === 429) return 'errors.rateLimited' as const;
  } else if (typeof error === 'object' && error !== null && 'code' in error) {
    if (Number(error.code) === 4001) return 'errors.rejected' as const;
    if (Number(error.code) === -32002) return 'errors.requestPending' as const;
  }
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(errorMessages, code)) {
    return errorMessages[code as keyof typeof errorMessages];
  }
  return 'errors.failed' as const;
}

export function useWalletAuthentication() {
  const session = useSessionQuery();
  const queryClient = useQueryClient();
  const login = useLoginMutation();
  const disconnect = useLogoutMutation();
  const isPending = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  const errors = useMutationState({
    filters: { mutationKey: sessionMutationKey },
    select: mutation => mutation.state.error,
  });
  const error = errors[errors.length - 1];
  const errorKey = isPending
    ? null
    : error
      ? getAuthErrorKey(error)
      : session.isError
        ? ('errors.session' as const)
        : null;
  const walletAddress = session.data?.user.wallets.find(
    wallet => wallet.chainNamespace === 'solana'
  )?.address;

  function closeCurrentDialog(content: React.ReactNode) {
    const modal = useModalStore.getState();
    if (modal.content === content) modal.closeModal();
  }

  function connect(walletName: string) {
    if (session.isPending || queryClient.isMutating({ mutationKey: sessionMutationKey }) > 0)
      return;
    const content = useModalStore.getState().content;
    login.mutate(walletName, { onSuccess: () => closeCurrentDialog(content) });
  }

  function logout() {
    if (queryClient.isMutating({ mutationKey: sessionMutationKey }) > 0) return;
    const content = useModalStore.getState().content;
    disconnect.mutate(undefined, {
      onSuccess: () => {
        closeCurrentDialog(content);
        // The server session is already gone even if the extension cannot disconnect.
        void disconnectWallet(walletAddress).catch(() => {});
      },
    });
  }

  return {
    session: session.data,
    walletAddress,
    checkingSession: session.isPending,
    isPending,
    errorKey,
    errorWalletName: error instanceof WalletAuthError ? error.walletName : undefined,
    connect,
    logout,
  };
}
