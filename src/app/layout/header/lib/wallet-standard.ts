import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletWithFeatures } from '@wallet-standard/base';
import { StandardDisconnect, type StandardDisconnectFeature } from '@wallet-standard/features';
import {
  SolanaSignIn,
  type SolanaSignInFeature,
  type SolanaSignInInput,
} from '@solana/wallet-standard-features';

type SignInWallet = WalletWithFeatures<SolanaSignInFeature>;

let connectedWallet: Wallet | undefined;

export class WalletAuthError extends Error {
  readonly code: 'WALLET_NOT_FOUND' | 'WALLET_SIGN_IN_UNSUPPORTED' | 'WALLET_RESPONSE_INVALID';
  readonly walletName: string;

  constructor(code: WalletAuthError['code'], walletName: string) {
    super(code);
    this.code = code;
    this.walletName = walletName;
  }
}

export function getWalletForSignIn(walletName: string): SignInWallet {
  const wallet = getWallets()
    .get()
    .find(registeredWallet => registeredWallet.name === walletName);
  if (!wallet) throw new WalletAuthError('WALLET_NOT_FOUND', walletName);

  const feature = wallet.features[SolanaSignIn] as
    SolanaSignInFeature[typeof SolanaSignIn] | undefined;
  if (
    !wallet.chains.some(chain => chain.startsWith('solana:')) ||
    typeof feature?.signIn !== 'function'
  ) {
    throw new WalletAuthError('WALLET_SIGN_IN_UNSUPPORTED', walletName);
  }
  return wallet as SignInWallet;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function signInWithWallet(wallet: SignInWallet, input: SolanaSignInInput) {
  // One input returns one standard output. Keep the wallet's message and signature bytes unchanged.
  const outputs = await wallet.features[SolanaSignIn].signIn(input);
  const proof = outputs[0];
  if (
    outputs.length !== 1 ||
    typeof proof?.account?.address !== 'string' ||
    !proof.account.address ||
    !(proof.signedMessage instanceof Uint8Array) ||
    proof.signedMessage.length === 0 ||
    proof.signedMessage.length > 4096 ||
    !(proof.signature instanceof Uint8Array) ||
    proof.signature.length !== 64 ||
    (proof.signatureType !== undefined && proof.signatureType !== 'ed25519')
  ) {
    throw new WalletAuthError('WALLET_RESPONSE_INVALID', wallet.name);
  }
  connectedWallet = wallet;
  return {
    address: proof.account.address,
    signedMessage: bytesToBase64(proof.signedMessage),
    signature: bytesToBase64(proof.signature),
  };
}

export async function disconnectWallet(address?: string): Promise<void> {
  const wallet =
    connectedWallet ??
    getWallets()
      .get()
      .find(registeredWallet =>
        registeredWallet.accounts.some(account => account.address === address)
      );
  connectedWallet = undefined;
  const feature = wallet?.features[StandardDisconnect] as
    StandardDisconnectFeature[typeof StandardDisconnect] | undefined;
  if (typeof feature?.disconnect === 'function') await feature.disconnect();
}
