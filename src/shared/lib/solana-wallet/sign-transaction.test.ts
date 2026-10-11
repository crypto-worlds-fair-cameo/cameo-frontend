import { beforeEach, describe, expect, it, vi } from 'vitest';
const registry = vi.hoisted(() => ({ wallets: [] as unknown[] }));
vi.mock('@wallet-standard/app', () => ({ getWallets: () => ({ get: () => registry.wallets }) }));
import {
  getTransactionSigningSupport,
  signSolanaTransaction,
  walletChain,
} from './sign-transaction';

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
});

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
