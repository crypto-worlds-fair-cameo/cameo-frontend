import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cameo.wallet-choice';

type WalletChoice = Readonly<{ address: string; walletName: string }>;

const listeners = new Set<() => void>();
// 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 이번 방문 동안만 기억한다.
let memoryChoice: WalletChoice | null = null;

function isWalletChoice(value: unknown): value is WalletChoice {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WalletChoice).address === 'string' &&
    typeof (value as WalletChoice).walletName === 'string'
  );
}

function readChoice(): WalletChoice | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isWalletChoice(value) ? value : memoryChoice;
  } catch {
    return memoryChoice;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

/**
 * 로그인에 쓴 지갑을 주소와 함께 기억한다.
 * 같은 주소를 여러 지갑이 가진 경우 서명할 지갑을 고르고, 새로고침 뒤 그 지갑에 다시 연결하는 데 쓴다.
 */
export function rememberWalletChoice(address: string, walletName: string) {
  memoryChoice = { address, walletName };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryChoice));
  } catch {
    // 메모리에 남긴 값으로 이번 방문을 이어간다.
  }
  notify();
}

/** 로그아웃하면 지갑 기억도 지운다. */
export function forgetWalletChoice() {
  memoryChoice = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 지울 저장소가 없으면 할 일이 없다.
  }
  notify();
}

/** 이 주소로 로그인할 때 쓴 지갑 이름. 다른 주소이거나 기록이 없으면 undefined다. */
export function rememberedWalletName(address: string | undefined): string | undefined {
  if (!address) return undefined;
  const choice = readChoice();
  return choice?.address === address ? choice.walletName : undefined;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 로그인·로그아웃해도 화면의 지갑 이름을 맞춘다.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** 화면에 보여 줄, 이 주소로 로그인할 때 쓴 지갑 이름. */
export function useRememberedWalletName(address: string | undefined): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => rememberedWalletName(address),
    () => undefined
  );
}
