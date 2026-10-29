import axios, { isAxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/http-client';
import { SeasonRequestError } from './seasons.types';

export type SeasonNftMintStatus =
  'NONE' | 'WAITING_SNAPSHOT' | 'PREPARING' | 'READY' | 'EMPTY' | 'BLOCKED';

export interface SeasonNftMintPendingTransaction {
  transactionId: string;
  serializedTransactionBase64: string;
  purpose: 'SETUP' | 'CREATOR_MINT';
}

export interface SeasonNftMintPreview {
  seasonId: string;
  status: SeasonNftMintStatus;
  network: 'devnet' | 'mainnet-beta';
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  eligibleCount: number;
  minSupply: string;
  supply: string;
  creatorAllocation: string;
  strokeCount: string;
  imageUrl: string | null;
  estimatedLamports: string | null;
  walletAddress: string;
  mintedCount: string;
  signatureCount: number;
  collectionAddress: string | null;
  pendingTransaction: SeasonNftMintPendingTransaction | null;
}

const decimal = /^(?:0|[1-9][0-9]*)$/u;
const statuses: readonly SeasonNftMintStatus[] = [
  'NONE',
  'WAITING_SNAPSHOT',
  'PREPARING',
  'READY',
  'EMPTY',
  'BLOCKED',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPreview(value: unknown): value is SeasonNftMintPreview {
  if (!isRecord(value)) return false;
  const pending = value.pendingTransaction;
  const pendingOk =
    pending === null ||
    (isRecord(pending) &&
      typeof pending.transactionId === 'string' &&
      typeof pending.serializedTransactionBase64 === 'string' &&
      (pending.purpose === 'SETUP' || pending.purpose === 'CREATOR_MINT'));
  return (
    typeof value.seasonId === 'string' &&
    statuses.includes(value.status as SeasonNftMintStatus) &&
    (value.network === 'devnet' || value.network === 'mainnet-beta') &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.startsAt === 'string' &&
    typeof value.endsAt === 'string' &&
    typeof value.eligibleCount === 'number' &&
    typeof value.minSupply === 'string' &&
    decimal.test(value.minSupply) &&
    typeof value.supply === 'string' &&
    decimal.test(value.supply) &&
    typeof value.creatorAllocation === 'string' &&
    decimal.test(value.creatorAllocation) &&
    typeof value.strokeCount === 'string' &&
    decimal.test(value.strokeCount) &&
    (value.imageUrl === null || typeof value.imageUrl === 'string') &&
    (value.estimatedLamports === null ||
      (typeof value.estimatedLamports === 'string' && decimal.test(value.estimatedLamports))) &&
    typeof value.walletAddress === 'string' &&
    typeof value.mintedCount === 'string' &&
    decimal.test(value.mintedCount) &&
    typeof value.signatureCount === 'number' &&
    (value.collectionAddress === null || typeof value.collectionAddress === 'string') &&
    pendingOk
  );
}

function readPreview(body: unknown): SeasonNftMintPreview {
  if (!isRecord(body) || !isPreview(body.data)) {
    throw new SeasonRequestError('The server returned an invalid response.', 'invalid-response');
  }
  return body.data;
}

function normalizeError(error: unknown): never {
  if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
    throw new SeasonRequestError('The request was cancelled.', 'aborted');
  }
  if (!isAxiosError(error)) {
    if (error instanceof SeasonRequestError) throw error;
    throw new SeasonRequestError('The request failed.', 'transport');
  }
  const body = error.response?.data;
  if (isRecord(body) && body.success === false && typeof body.message === 'string') {
    throw new SeasonRequestError(
      body.message,
      'business',
      error.response?.status,
      typeof body.code === 'string' ? body.code : undefined
    );
  }
  throw new SeasonRequestError('The request failed.', 'transport', error.response?.status);
}

export async function getSeasonNftMintPreview(
  seasonId: string,
  supply?: string
): Promise<SeasonNftMintPreview> {
  try {
    const response = await axiosInstance.get(`/seasons/${seasonId}/nft/mint`, {
      params: supply ? { supply } : undefined,
      withCredentials: true,
    });
    return readPreview(response.data);
  } catch (error: unknown) {
    normalizeError(error);
  }
}

export async function requestSeasonNftMint(
  seasonId: string,
  input: { supply: string; description?: string }
): Promise<SeasonNftMintPreview> {
  try {
    const response = await axiosInstance.post(`/seasons/${seasonId}/nft/mint`, input, {
      withCredentials: true,
    });
    return readPreview(response.data);
  } catch (error: unknown) {
    normalizeError(error);
  }
}

export async function submitSeasonNftMintTransaction(
  seasonId: string,
  input: { transactionId: string; signedTransactionBase64: string }
): Promise<void> {
  try {
    await axiosInstance.post(`/seasons/${seasonId}/nft/mint/transactions`, input, {
      withCredentials: true,
    });
  } catch (error: unknown) {
    normalizeError(error);
  }
}
