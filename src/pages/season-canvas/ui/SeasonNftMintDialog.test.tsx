import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonNftMintPreview } from '../api/season-nft-mint';
import { SeasonRequestError } from '../api/seasons.types';
import { SeasonNftMintDialog } from './SeasonNftMintDialog';

const api = vi.hoisted(() => ({
  getSeasonNftMintPreview: vi.fn(),
  requestSeasonNftMint: vi.fn(),
  submitSeasonNftMintTransaction: vi.fn(),
  signSolanaTransactions: vi.fn(),
}));
vi.mock('../api/season-nft-mint', () => ({
  getSeasonNftMintPreview: api.getSeasonNftMintPreview,
  requestSeasonNftMint: api.requestSeasonNftMint,
  submitSeasonNftMintTransaction: api.submitSeasonNftMintTransaction,
}));
vi.mock('@/shared/lib/solana-wallet/sign-transaction', () => ({
  signSolanaTransactions: api.signSolanaTransactions,
}));

const preview: SeasonNftMintPreview = {
  seasonId: 'season-1',
  status: 'NONE',
  network: 'devnet',
  title: 'Night Sky',
  description: '',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-02T00:00:00.000Z',
  eligibleCount: 2,
  minSupply: '2',
  supply: '2',
  creatorAllocation: '1',
  strokeCount: '5',
  imageUrl: null,
  estimatedLamports: '12000000',
  walletAddress: 'BhBXZAzWGGx2wZCwbkDC9NDQh5NBreTJ3TvDe2GNW1aD',
  mintedCount: '0',
  signatureCount: 6,
  collectionAddress: null,
  pendingTransaction: null,
};

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SeasonNftMintDialog
        open
        seasonId="season-1"
        walletAddress={preview.walletAddress}
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>
  );
  return onOpenChange;
}

/** 정보 → 수량 → 확인 단계까지 이동한다. */
async function openConfirmStep() {
  // 미리보기를 받아 와야 다음 버튼이 켜진다.
  await screen.findByText('시즌 정보 : Night Sky');
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  // 수량 단계에는 위쪽 뒤로 가기와 아래쪽 확인 버튼이 같은 이름이라 아래쪽 버튼을 누른다.
  const createButtons = screen.getAllByRole('button', { name: 'NFT 만들기' });
  fireEvent.click(createButtons[createButtons.length - 1]);
  return screen.findByRole('button', { name: '서명하고 발행' });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getSeasonNftMintPreview.mockResolvedValue(preview);
});

describe('SeasonNftMintDialog', () => {
  it('shows that the mint runs on the Solana practice network', async () => {
    renderDialog();
    await openConfirmStep();
    expect(screen.getByText('Solana Devnet(연습망)')).toBeTruthy();
  });

  it('stops asking the wallet to sign after the creator cancels mid-mint', async () => {
    let finishSigning: (signed: string[]) => void = () => {};
    api.requestSeasonNftMint.mockResolvedValue({
      ...preview,
      status: 'PREPARING',
      pendingTransaction: {
        transactionId: 'tx-1',
        serializedTransactionBase64: 'AQ==',
        purpose: 'SETUP',
      },
    });
    api.signSolanaTransactions.mockImplementation(
      () =>
        new Promise<string[]>(resolve => {
          finishSigning = resolve;
        })
    );
    const onOpenChange = renderDialog();
    fireEvent.click(await openConfirmStep());
    fireEvent.click(await screen.findByRole('button', { name: '팬텀에서 확인' }));
    await waitFor(() => expect(api.signSolanaTransactions).toHaveBeenCalledTimes(1));

    // 지갑 서명 창이 떠 있는 동안 취소하면 창을 닫고 확인 단계로 돌아간다.
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByRole('button', { name: '서명하고 발행' })).toBeTruthy();

    // 취소 뒤에 지갑이 서명을 돌려줘도 서버에 보내거나 다음 서명을 요청하지 않는다.
    finishSigning(['signed']);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.submitSeasonNftMintTransaction).not.toHaveBeenCalled();
    expect(api.signSolanaTransactions).toHaveBeenCalledTimes(1);
  });

  it('asks Phantom to approve leftover NFTs in one confirmation', async () => {
    api.requestSeasonNftMint.mockResolvedValue({
      ...preview,
      status: 'PREPARING',
      pendingTransaction: {
        transactionId: 'mint-1',
        serializedTransactionBase64: 'AQ==',
        purpose: 'CREATOR_MINT',
      },
      pendingTransactions: [
        {
          transactionId: 'mint-1',
          serializedTransactionBase64: 'AQ==',
          purpose: 'CREATOR_MINT',
        },
        {
          transactionId: 'mint-2',
          serializedTransactionBase64: 'Ag==',
          purpose: 'CREATOR_MINT',
        },
      ],
    });
    api.signSolanaTransactions.mockResolvedValue(['one', 'two']);
    api.submitSeasonNftMintTransaction.mockResolvedValue(undefined);
    api.getSeasonNftMintPreview.mockResolvedValue({ ...preview, status: 'READY' });
    renderDialog();
    fireEvent.click(await openConfirmStep());
    fireEvent.click(await screen.findByRole('button', { name: '팬텀에서 확인 (2건)' }));
    await waitFor(() =>
      expect(api.signSolanaTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          serializedTransactionsBase64: ['AQ==', 'Ag=='],
        })
      )
    );
    await waitFor(() => expect(api.submitSeasonNftMintTransaction).toHaveBeenCalledTimes(2));
  });

  it('shows why a signature was not accepted and keeps the confirm button', async () => {
    const preparing: SeasonNftMintPreview = {
      ...preview,
      status: 'PREPARING',
      pendingTransaction: {
        transactionId: 'tx-1',
        serializedTransactionBase64: 'AQ==',
        purpose: 'SETUP',
      },
    };
    api.requestSeasonNftMint.mockResolvedValue(preparing);
    renderDialog();
    const sign = await openConfirmStep();
    // 발행 중 다시 조회해도 같은 서명 요청이 남아 있다.
    api.getSeasonNftMintPreview.mockResolvedValue(preparing);
    fireEvent.click(sign);

    // 서버가 서명한 거래를 거절하면 그 사유를 보여 준다.
    api.signSolanaTransactions.mockResolvedValue(['signed']);
    api.submitSeasonNftMintTransaction.mockRejectedValueOnce(
      new SeasonRequestError(
        'The signed transaction does not match the prepared transaction.',
        'business',
        400,
        'NFT_TRANSACTION_INVALID'
      )
    );
    fireEvent.click(await screen.findByRole('button', { name: '팬텀에서 확인' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The signed transaction does not match the prepared transaction.'
    );
    expect(screen.getByRole('button', { name: '팬텀에서 확인' })).toBeTruthy();

    // 지갑이 서명을 돌려주지 않으면 지갑을 확인하라고 안내한다.
    api.signSolanaTransactions.mockRejectedValueOnce(new Error('User rejected'));
    fireEvent.click(screen.getByRole('button', { name: '팬텀에서 확인' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        '지갑에서 서명하지 못했습니다. 팬텀을 확인한 뒤 다시 눌러 주세요.'
      )
    );
    expect(api.submitSeasonNftMintTransaction).toHaveBeenCalledTimes(1);
  });
});
