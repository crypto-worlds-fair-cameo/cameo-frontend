import { useEffect, useReducer } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { SolanaSignIn } from '@solana/wallet-standard-features';

/**
 * 연결 창에 보여 주는 솔라나 지갑과 설치 안내 주소.
 * 서버는 서버가 만든 거래를 그대로(안전 확인 추가만 허용) 서명해야 받아 주므로, 시험한 지갑만 둔다.
 */
export const SUPPORTED_WALLETS = [
  { name: 'Phantom', installUrl: 'https://phantom.com/download' },
  { name: 'Solflare', installUrl: 'https://solflare.com' },
  { name: 'Backpack', installUrl: 'https://backpack.app' },
] as const;

export type SupportedWalletName = (typeof SUPPORTED_WALLETS)[number]['name'];

export interface SupportedWalletOption {
  name: SupportedWalletName;
  installUrl: string;
  /** 브라우저에 설치돼 지갑 공통 규격(Wallet Standard)으로 솔라나 로그인을 제공하는지. */
  installed: boolean;
  /** 지갑이 직접 알려 주는 아이콘(data URL). 설치되지 않았으면 없다. */
  icon?: string;
}

/** 이름이 같고 솔라나 로그인을 지원하는, 등록된 지갑을 찾는다. */
export function findSignInWallet(name: string): Wallet | undefined {
  return getWallets()
    .get()
    .find(
      wallet =>
        wallet.name === name &&
        wallet.chains.some(chain => chain.startsWith('solana:')) &&
        SolanaSignIn in wallet.features
    );
}

/** 지원 지갑 목록과 설치 여부. 확장 프로그램이 늦게 등록돼도 바로 다시 계산한다. */
export function useSupportedWallets(): SupportedWalletOption[] {
  const [, refresh] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    const registry = getWallets();
    const unregisterRegister = registry.on('register', refresh);
    const unregisterUnregister = registry.on('unregister', refresh);
    return () => {
      unregisterRegister();
      unregisterUnregister();
    };
  }, []);

  return SUPPORTED_WALLETS.map(option => {
    const wallet = findSignInWallet(option.name);
    return {
      name: option.name,
      installUrl: option.installUrl,
      installed: Boolean(wallet),
      icon: wallet?.icon,
    };
  });
}
