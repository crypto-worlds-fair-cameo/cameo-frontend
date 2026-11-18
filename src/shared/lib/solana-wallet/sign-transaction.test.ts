import { beforeEach, describe, expect, it, vi } from 'vitest';
const registry = vi.hoisted(() => ({ wallets: [] as unknown[] }));
vi.mock('@wallet-standard/app', () => ({ getWallets: () => ({ get: () => registry.wallets }) }));
import {
  getTransactionSigningSupport,
  reconnectSigningWallet,
  signSolanaTransaction,
  signSolanaTransactions,
  walletChain,
} from './sign-transaction';
import { forgetWalletChoice, rememberWalletChoice } from './wallet-choice';

const address = '11111111111111111111111111111111';
function wallet(options?: { accountChains?: string[]; feature?: boolean; output?: Uint8Array }) {
  const signTransaction = vi
    .fn()
    .mockResolvedValue([{ signedTransaction: options?.output ?? new Uint8Array([1, 2, 3]) }]);
  const account = {
    address,
    publicKey: new Uint8Array(32),
    chains: options?.accountChains ?? ['solana:devnet'],
    features: ['solana:signTransaction'],
    label: 'Test',
    icon: undefined,
  };
  return {
    signTransaction,
    account,
    value: {
      name: 'Test Wallet',
      icon: 'data:image/svg+xml,<svg/>',
      version: '1.0.0',
      chains: ['solana:devnet'],
      accounts: [account],
      features:
        options?.feature === false
          ? {}
          : {
              'solana:signTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy'],
                signTransaction,
              },
            },
    },
  };
}
beforeEach(() => {
  registry.wallets = [];
  forgetWalletChoice();
});

/** 같은 지갑 모양에 이름과 계정 공개 여부만 바꾼다. connect는 조용한 연결 요청을 받으면 계정을 내놓는다. */
function namedWallet(name: string, options?: { exposed?: boolean; connect?: () => Promise<void> }) {
  const base = wallet();
  const accounts = options?.exposed === false ? [] : [base.account];
  const connect = vi.fn(
    options?.connect ??
      (async () => {
        accounts.splice(0, accounts.length, base.account);
      })
  );
  return {
    ...base,
    connect,
    value: {
      ...base.value,
      name,
      accounts,
      features: { ...base.value.features, 'standard:connect': { version: '1.0.0', connect } },
    },
  };
}

describe('Wallet Standard transaction adapter', () => {
  it('maps backend networks to Wallet Standard chains', () => {
    expect(walletChain('devnet')).toBe('solana:devnet');
    expect(walletChain('mainnet-beta')).toBe('solana:mainnet');
  });
  it('uses the selected matching account and signTransaction only', async () => {
    const target = wallet();
    registry.wallets = [target.value];
    const signed = await signSolanaTransaction({
      walletAddress: address,
      network: 'devnet',
      serializedTransactionBase64: 'AQI=',
    });
    expect(target.signTransaction).toHaveBeenCalledWith({
      account: target.account,
      transaction: new Uint8Array([1, 2]),
      chain: 'solana:devnet',
    });
    expect(signed).toBe('AQID');
  });

  it('signs several transactions in one wallet request', async () => {
    const target = wallet();
    target.signTransaction.mockResolvedValue([
      { signedTransaction: new Uint8Array([1]) },
      { signedTransaction: new Uint8Array([2]) },
    ]);
    registry.wallets = [target.value];
    const signed = await signSolanaTransactions({
      walletAddress: address,
      network: 'devnet',
      serializedTransactionsBase64: ['AQI=', 'AgI='],
    });
    expect(target.signTransaction).toHaveBeenCalledTimes(1);
    expect(target.signTransaction.mock.calls[0]).toHaveLength(2);
    expect(signed).toEqual(['AQ==', 'Ag==']);
  });
  it('asks the wallet used to sign in when two wallets hold the same address', async () => {
    const phantom = namedWallet('Phantom');
    const solflare = namedWallet('Solflare');
    registry.wallets = [phantom.value, solflare.value];
    // 어느 지갑으로 로그인했는지 모르면 임의 지갑을 열지 않는다.
    expect(getTransactionSigningSupport(address, 'devnet')).toEqual({
      supported: false,
      reason: 'ACCOUNT_AMBIGUOUS',
    });

    rememberWalletChoice(address, 'Solflare');
    await signSolanaTransaction({
      walletAddress: address,
      network: 'devnet',
      serializedTransactionBase64: 'AQI=',
    });
    expect(solflare.signTransaction).toHaveBeenCalledTimes(1);
    expect(phantom.signTransaction).not.toHaveBeenCalled();
  });

  it('quietly reconnects the wallet used to sign in when it does not show the account after a reload', async () => {
    const backpack = namedWallet('Backpack', { exposed: false });
    const phantom = namedWallet('Phantom', { exposed: false });
    registry.wallets = [phantom.value, backpack.value];
    rememberWalletChoice(address, 'Backpack');

    await signSolanaTransaction({
      walletAddress: address,
      network: 'devnet',
      serializedTransactionBase64: 'AQI=',
    });
    expect(backpack.connect).toHaveBeenCalledWith({ silent: true });
    expect(phantom.connect).not.toHaveBeenCalled();
    expect(backpack.signTransaction).toHaveBeenCalledTimes(1);

    // 계정이 이미 보이면 다시 연결하지 않는다.
    await signSolanaTransaction({
      walletAddress: address,
      network: 'devnet',
      serializedTransactionBase64: 'AQI=',
    });
    expect(backpack.connect).toHaveBeenCalledTimes(1);
  });

  it('treats a sign-in from before the wallet choice was remembered as Phantom', async () => {
    const phantom = namedWallet('Phantom', { exposed: false });
    registry.wallets = [phantom.value];
    expect(await reconnectSigningWallet(address)).toBe(true);
    expect(phantom.connect).toHaveBeenCalledWith({ silent: true });
  });

  it('reports a missing account when the wallet refuses a quiet reconnect', async () => {
    const solflare = namedWallet('Solflare', {
      exposed: false,
      connect: async () => {
        throw new Error('not trusted');
      },
    });
    registry.wallets = [solflare.value];
    rememberWalletChoice(address, 'Solflare');
    await expect(
      signSolanaTransaction({
        walletAddress: address,
        network: 'devnet',
        serializedTransactionBase64: 'AQI=',
      })
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    expect(solflare.signTransaction).not.toHaveBeenCalled();
  });

  it('reports account, chain, and feature failures without requesting a signature', () => {
    const missingFeature = wallet({ feature: false });
    registry.wallets = [missingFeature.value];
    expect(getTransactionSigningSupport(address, 'devnet')).toEqual({
      supported: false,
      reason: 'SIGN_TRANSACTION_UNSUPPORTED',
    });
    expect(missingFeature.signTransaction).not.toHaveBeenCalled();
    const wrongChain = wallet({ accountChains: ['solana:mainnet'] });
    registry.wallets = [wrongChain.value];
    expect(getTransactionSigningSupport(address, 'devnet')).toEqual({
      supported: false,
      reason: 'CHAIN_UNSUPPORTED',
    });
  });

  it('discards a signature when the registry account changes while the wallet is open', async () => {
    let resolveSignature!: (value: { signedTransaction: Uint8Array }[]) => void;
    const original = wallet();
    original.signTransaction.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveSignature = resolve;
        })
    );
    registry.wallets = [original.value];
    const signing = signSolanaTransaction({
      walletAddress: address,
      network: 'devnet',
      serializedTransactionBase64: 'AQI=',
    });

    registry.wallets = [wallet().value];
    resolveSignature([{ signedTransaction: new Uint8Array([1, 2, 3]) }]);

    await expect(signing).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  });
});
