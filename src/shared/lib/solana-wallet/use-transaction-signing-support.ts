import { useEffect, useReducer } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { StandardEvents, type StandardEventsFeature } from '@wallet-standard/features';
import { getTransactionSigningSupport, type TransactionSigningSupport } from './sign-transaction';
type SolanaNetwork = 'devnet' | 'mainnet-beta';

/** 지갑 등록 및 계정 변경을 구독해 현재 주소의 서명 가능 여부를 즉시 다시 계산한다. */
export function useTransactionSigningSupport(
  walletAddress: string,
  network: SolanaNetwork
): TransactionSigningSupport {
  const [, refresh] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    const registry = getWallets();
    let walletCleanups: Array<() => void> = [];

    const subscribeWallets = () => {
      for (const cleanup of walletCleanups) cleanup();
      walletCleanups = registry.get().flatMap((wallet: Wallet) => {
        const events = wallet.features[StandardEvents] as
          StandardEventsFeature[typeof StandardEvents] | undefined;
        return events ? [events.on('change', refresh)] : [];
      });
    };

    const refreshRegistry = () => {
      subscribeWallets();
      refresh();
    };

    subscribeWallets();
    const unregisterRegister = registry.on('register', refreshRegistry);
    const unregisterUnregister = registry.on('unregister', refreshRegistry);
    return () => {
      unregisterRegister();
      unregisterUnregister();
      for (const cleanup of walletCleanups) cleanup();
    };
  }, [network, walletAddress]);

  return getTransactionSigningSupport(walletAddress, network);
}
