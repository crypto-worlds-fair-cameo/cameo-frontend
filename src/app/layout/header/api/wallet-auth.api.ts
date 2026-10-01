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

interface WalletLoginResponse extends AuthenticatedSession {
  isNewUser: boolean;
}

export interface LoginBody {
  challengeId: string;
  address: string;
  signedMessage: string;
  signature: string;
}

const credentials = { withCredentials: true } as const;

export async function authenticateWallet(walletName: string): Promise<WalletLoginResponse> {
  const wallet = getWalletForSignIn(walletName);
  // Each attempt needs its own challenge; never retry a consumed signature.
  const challenge = await axiosInstance.post<ApiResponse<Challenge>>(
    '/auth/challenges',
    undefined,
    credentials
  );
  const proof = await signInWithWallet(wallet, challenge.data.data.signInInput);
  const response = await axiosInstance.post<ApiResponse<WalletLoginResponse>>(
    '/auth/login',
    { challengeId: challenge.data.data.challengeId, ...proof } satisfies LoginBody,
    credentials
  );
  return response.data.data;
}

export async function logout(): Promise<void> {
  await axiosInstance.post('/auth/logout', undefined, credentials);
}

export async function setDisplayName(displayName: string) {
  const response = await axiosInstance.patch<ApiResponse<{ id: string; displayName: string }>>(
    '/users/me/display-name',
    { displayName },
    credentials
  );
  if (response.status !== 200) throw new Error('Unexpected nickname update response');
  return response.data.data;
}
