import type { QueryClient } from '@tanstack/react-query';
import { sessionMutationKey } from '@/entities/session';
import { WalletConnectContent, WalletConnectTitle } from '../ui/WalletConnectContent';
import { openWalletDialogStep } from './openWalletDialogStep';

/** 헤더와 시즌 참가 팝업이 같은 지갑 연결 창을 연다. */
export function openWalletConnectDialog(
  queryClient: QueryClient,
  returnFocusElement: HTMLElement | null = null
) {
  const mutations = queryClient.getMutationCache();
  for (const mutation of mutations.findAll({
    mutationKey: sessionMutationKey,
    status: 'error',
  }))
    mutations.remove(mutation);
  openWalletDialogStep({
    title: <WalletConnectTitle />,
    content: <WalletConnectContent />,
    returnFocusElement,
  });
}
