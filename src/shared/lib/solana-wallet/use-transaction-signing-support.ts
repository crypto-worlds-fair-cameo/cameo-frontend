import { useEffect, useReducer } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { StandardEvents, type StandardEventsFeature } from '@wallet-standard/features';
import {
  getTransactionSigningSupport,
  reconnectSigningWallet,
  type TransactionSigningSupport,
} from './sign-transaction';
type SolanaNetwork = 'devnet' | 'mainnet-beta';

/**
 * 지갑 등록 및 계정 변경을 구독해 현재 주소의 서명 가능 여부를 즉시 다시 계산한다.
 * 새로고침 뒤 지갑이 계정을 알려 주지 않으면 로그인에 쓴 지갑에 팝업 없이 다시 연결해 본다.
 */
export function useTransactionSigningSupport(
  walletAddress: string,
  network: SolanaNetwork
): TransactionSigningSupport {
  const [, refresh] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    const registry = getWallets();
    let walletCleanups: Array<() => void> = [];
    let active = true;
    const reconnect = () => {
      void reconnectSigningWallet(walletAddress).then(() => {
        if (active) refresh();
      });
    };

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
    reconnect();
    // 확장 프로그램이 늦게 등록되면 그때 다시 연결해 본다.
    const unregisterRegister = registry.on('register', () => {
      refreshRegistry();
      reconnect();
    });
    const unregisterUnregister = registry.on('unregister', refreshRegistry);
    return () => {
      active = false;
      unregisterRegister();
      unregisterUnregister();
      for (const cleanup of walletCleanups) cleanup();
    };
  }, [network, walletAddress]);

  return getTransactionSigningSupport(walletAddress, network);
}
