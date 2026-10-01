import { axiosInstance } from '@/shared/api/http-client';
import type { AuthenticatedSession } from '@/entities/session';
import { getWalletForSignIn, signInWithWallet } from '../lib/wallet-standard';

interface ApiResponse<T> {
  statusCode: number;
  success: true;
  data: T;
}

export interface SignInInput {
  domain: string;
  statement: string;
  uri: string;
  version: '1';
  chainId: 'mainnet';
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  requestId: string;
}

interface Challenge {
  challengeId: string;
  signInInput: SignInInput;
}

export interface LoginBody {
  challengeId: string;
  address: string;
  signedMessage: string;
  signature: string;
}

const credentials = { withCredentials: true } as const;

export async function authenticateWallet(walletName: string): Promise<AuthenticatedSession> {
  const wallet = getWalletForSignIn(walletName);
  // Each attempt needs its own challenge; never retry a consumed signature.
  const challenge = await axiosInstance.post<ApiResponse<Challenge>>(
    '/auth/challenges',
    undefined,
    credentials
  );
  const proof = await signInWithWallet(wallet, challenge.data.data.signInInput);
  const response = await axiosInstance.post<ApiResponse<AuthenticatedSession>>(
    '/auth/login',
    { challengeId: challenge.data.data.challengeId, ...proof } satisfies LoginBody,
    credentials
  );
  return response.data.data;
}

export async function logout(): Promise<void> {
  await axiosInstance.post('/auth/logout', undefined, credentials);
}
