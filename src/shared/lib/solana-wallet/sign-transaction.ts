import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import {
  SolanaSignTransaction,
  type SolanaSignTransactionFeature,
} from '@solana/wallet-standard-features';

export type SolanaNetwork = 'devnet' | 'mainnet-beta';
export type TransactionSigningFailure =
  'ACCOUNT_NOT_FOUND' | 'ACCOUNT_AMBIGUOUS' | 'CHAIN_UNSUPPORTED' | 'SIGN_TRANSACTION_UNSUPPORTED';
export type TransactionSigningSupport =
  { supported: true } | { supported: false; reason: TransactionSigningFailure };

type SigningMatch = {
  wallet: Wallet;
  account: WalletAccount;
  feature: SolanaSignTransactionFeature[typeof SolanaSignTransaction];
};

export class SolanaTransactionSigningError extends Error {
  readonly code:
    | TransactionSigningFailure
    | 'ACCOUNT_CHANGED'
    | 'TRANSACTION_INVALID'
    | 'WALLET_RESPONSE_INVALID';

  constructor(
    code:
      | TransactionSigningFailure
      | 'ACCOUNT_CHANGED'
      | 'TRANSACTION_INVALID'
      | 'WALLET_RESPONSE_INVALID'
  ) {
    super(code);
    this.name = 'SolanaTransactionSigningError';
    this.code = code;
  }
}

export function walletChain(network: SolanaNetwork) {
  return network === 'devnet' ? 'solana:devnet' : 'solana:mainnet';
}

function matchingAccounts(walletAddress: string) {
  return getWallets()
    .get()
    .flatMap(wallet =>
      wallet.accounts
        .filter(account => account.address === walletAddress)
        .map(account => ({ wallet, account }))
    );
}

/** 현재 registry에서 주소·chain·legacy signing을 모두 만족하는 하나의 계정을 고른다. */
function resolveSigningMatch(walletAddress: string, network: SolanaNetwork): SigningMatch {
  const candidates = matchingAccounts(walletAddress);
  if (candidates.length === 0) {
    throw new SolanaTransactionSigningError('ACCOUNT_NOT_FOUND');
  }
  const chain = walletChain(network);
  const chainMatches = candidates.filter(
    ({ wallet, account }) => wallet.chains.includes(chain) && account.chains.includes(chain)
  );
  if (chainMatches.length === 0) {
    throw new SolanaTransactionSigningError('CHAIN_UNSUPPORTED');
  }
  const signingMatches = chainMatches.flatMap(({ wallet, account }) => {
    const feature = wallet.features[SolanaSignTransaction] as
      SolanaSignTransactionFeature[typeof SolanaSignTransaction] | undefined;
    return account.features.includes(SolanaSignTransaction) &&
      typeof feature?.signTransaction === 'function' &&
      feature.supportedTransactionVersions.includes('legacy')
      ? [{ wallet, account, feature }]
      : [];
  });
  if (signingMatches.length === 0) {
    throw new SolanaTransactionSigningError('SIGN_TRANSACTION_UNSUPPORTED');
  }
  // 같은 주소를 여러 지갑이 제시하면 임의 확장 프로그램을 열지 않는다.
  if (signingMatches.length !== 1) {
    throw new SolanaTransactionSigningError('ACCOUNT_AMBIGUOUS');
  }
  return signingMatches[0]!;
}

export function getTransactionSigningSupport(
  walletAddress: string,
  network: SolanaNetwork
): TransactionSigningSupport {
  try {
    resolveSigningMatch(walletAddress, network);
    return { supported: true };
  } catch (error) {
    if (error instanceof SolanaTransactionSigningError) {
      return { supported: false, reason: error.code as TransactionSigningFailure };
    }
    throw error;
  }
}

function base64ToBytes(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new SolanaTransactionSigningError('TRANSACTION_INVALID');
  }
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.length === 0 || bytes.length > 1232) {
    throw new SolanaTransactionSigningError('TRANSACTION_INVALID');
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** 서버가 준비한 legacy 거래를 선택 계정으로 서명하고 같은 raw wire 형식으로 반환한다. */
export async function signSolanaTransaction(input: {
  walletAddress: string;
  network: SolanaNetwork;
  serializedTransactionBase64: string;
}): Promise<string> {
  const { wallet, account, feature } = resolveSigningMatch(input.walletAddress, input.network);
  const outputs = await feature.signTransaction({
    account,
    transaction: base64ToBytes(input.serializedTransactionBase64),
    chain: walletChain(input.network),
  });
  const signed = outputs[0]?.signedTransaction;
  if (
    outputs.length !== 1 ||
    !(signed instanceof Uint8Array) ||
    signed.length === 0 ||
    signed.length > 1232
  ) {
    throw new SolanaTransactionSigningError('WALLET_RESPONSE_INVALID');
  }
  // 팝업이 열린 동안 registry가 바뀌면 이전 계정의 반환값을 현재 선택 결과로 제출하지 않는다.
  try {
    const current = resolveSigningMatch(input.walletAddress, input.network);
    if (current.wallet !== wallet || current.account !== account) {
      throw new SolanaTransactionSigningError('ACCOUNT_CHANGED');
    }
  } catch (error) {
    if (error instanceof SolanaTransactionSigningError && error.code === 'ACCOUNT_CHANGED') {
      throw error;
    }
    throw new SolanaTransactionSigningError('ACCOUNT_CHANGED');
  }
  return bytesToBase64(signed);
}
