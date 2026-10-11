import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SeasonNftRequestError,
  type SeasonNftSummary,
  type SeasonNftView,
} from '../api/season-nft.types';
import { lamportsToSol } from '../lib/lamports';
import { SeasonNftClaimCard } from './SeasonNftClaimCard';

const model = vi.hoisted(() => ({ useSeasonNftClaim: vi.fn() }));
vi.mock('../model/useSeasonNftClaim', () => ({ useSeasonNftClaim: model.useSeasonNftClaim }));

const address = '11111111111111111111111111111111';
function fullView(overrides: Partial<SeasonNftView> = {}): SeasonNftView {
  return {
    seasonId: '11111111-1111-4111-8111-111111111111',
    network: 'devnet',
    availability: 'READY',
    reason: null,
    name: 'Season NFT',
    imageUrl: `https://arweave.net/${'A'.repeat(43)}`,
    metadataUri: `https://arweave.net/${'B'.repeat(43)}`,
    eligibleCount: 2,
    claim: {
      eligibility: 'ELIGIBLE',
      state: 'UNCLAIMED',
      walletAddress: address,
      activeAttemptId: null,
      assetAddress: null,
      signature: null,
      receiptState: 'NONE',
      claimedAt: null,
    },
    ...overrides,
  };
}
function result(overrides: Record<string, unknown> = {}) {
  return {
    session: { activeWallet: { address } },
    view: fullView(),
    statusQuery: { isPending: false, isError: false, refetch: vi.fn() },
    attempt: undefined,
    attemptQuery: { isError: false, refetch: vi.fn() },
    support: { supported: true },
    signatureError: null,
    isStarting: false,
    isSigning: false,
    isRefreshingError: false,
    startError: null,
    submitError: null,
    startClaim: vi.fn(),
    sign: vi.fn(),
    refreshAfterError: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  model.useSeasonNftClaim.mockReturnValue(result());
});

describe('SeasonNftClaimCard', () => {
  it.each([
    ['WAITING_FOR_END', null, '시즌 종료 후 수령할 수 있습니다.'],
    ['PREPARING', null, '최종 NFT를 준비하고 있습니다.'],
    ['EMPTY', null, '수령할 NFT가 없습니다.'],
    ['UNAVAILABLE', 'CANCELLED', '취소된 시즌은 NFT를 수령할 수 없습니다.'],
    ['UNAVAILABLE', 'FORCE_ENDED', '조기 종료된 시즌은 NFT를 수령할 수 없습니다.'],
    ['UNAVAILABLE', 'FEATURE_DISABLED', 'NFT 수령 기능을 사용할 수 없습니다.'],
  ] as const)('renders %s without a claim action', (availability, reason, message) => {
    model.useSeasonNftClaim.mockReturnValue(result({ view: fullView({ availability, reason }) }));
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /NFT 받기|서명|다시 시도/ })).toBeNull();
  });

  it.each([
    ['NOT_PARTICIPANT', '이 시즌에 참여한 사용자만 수령할 수 있습니다.'],
    ['NO_VALID_STROKE', '유효한 획을 남긴 참여자만 수령할 수 있습니다.'],
  ] as const)('renders ineligible reason %s without a button', (eligibility, message) => {
    const view = fullView();
    view.claim.eligibility = eligibility;
    model.useSeasonNftClaim.mockReturnValue(result({ view }));
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens claim preparation from Enter and shows a normal image without canvas loading', async () => {
    const startClaim = vi.fn();
    model.useSeasonNftClaim.mockReturnValue(result({ startClaim }));
    const user = userEvent.setup();
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByRole('img', { name: 'Season NFT' }).getAttribute('src')).toContain(
      'arweave.net'
    );
    const button = screen.getByRole('button', { name: 'NFT 받기' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(startClaim).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ALLOWLIST_PROOF', '참여 자격 등록 서명', '참여 자격 등록 예상 비용'],
    ['MINT', 'NFT 발행 서명', 'NFT 발행 예상 비용'],
  ] as const)(
    'shows a separate explicit %s approval with exact cost',
    (step, buttonName, costLabel) => {
      const sign = vi.fn();
      model.useSeasonNftClaim.mockReturnValue(
        result({
          sign,
          attempt: {
            attemptId: 'attempt-a',
            state: 'AWAITING_SIGNATURE',
            step,
            walletAddress: address,
            network: 'devnet',
            transaction: {
              transactionId: 'transaction-a',
              serializedTransactionBase64: 'AQ==',
              lastValidBlockHeight: '1',
              estimatedCostLamports: '1000000001',
              estimatedAt: '2026-10-10T00:00:00.000Z',
            },
            errorCode: null,
            retryable: false,
          },
        })
      );
      render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
      expect(screen.getByText(costLabel)).toBeTruthy();
      expect(screen.getByText('1.000000001 SOL')).toBeTruthy();
      expect(screen.getByText('예상 비용이며 실제 비용은 달라질 수 있습니다.')).toBeTruthy();
      expect(screen.getByRole('button', { name: buttonName })).toBeTruthy();
    }
  );

  it('blocks signing for a fixed-wallet mismatch and unsupported wallet', () => {
    model.useSeasonNftClaim.mockReturnValue(
      result({
        session: { activeWallet: { address: '22222222222222222222222222222222' } },
        support: { supported: false, reason: 'ACCOUNT_NOT_FOUND' },
      })
    );
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByText('이 시즌에 참여한 지갑으로 연결해 주세요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NFT 받기' }).hasAttribute('disabled')).toBe(true);
  });

  it('never offers another mint while receipt details resolve and links only verified evidence', () => {
    const resolving = fullView();
    resolving.claim = { ...resolving.claim, state: 'CLAIMED', receiptState: 'RESOLVING' };
    model.useSeasonNftClaim.mockReturnValue(result({ view: resolving }));
    const rendered = render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByText('수령 완료 · 거래 정보 확인 중')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();

    const verified = fullView();
    verified.claim = {
      ...verified.claim,
      state: 'CLAIMED',
      receiptState: 'VERIFIED',
      assetAddress: address,
      signature: '3'.repeat(64),
    };
    model.useSeasonNftClaim.mockReturnValue(result({ view: verified }));
    rendered.rerender(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByRole('link', { name: 'NFT 보기' }).getAttribute('href')).toContain(
      '?cluster=devnet'
    );
    expect(screen.getByRole('link', { name: '거래 보기' }).getAttribute('href')).toContain('/tx/');
  });

  it('keeps a completed resolving receipt visible even if availability later becomes unavailable', () => {
    const resolving = fullView({ availability: 'UNAVAILABLE', reason: 'FEATURE_DISABLED' });
    resolving.claim = { ...resolving.claim, state: 'CLAIMED', receiptState: 'RESOLVING' };
    model.useSeasonNftClaim.mockReturnValue(result({ view: resolving }));
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.getByText('수령 완료 · 거래 정보 확인 중')).toBeTruthy();
    expect(screen.queryByText('NFT 수령 기능을 사용할 수 없습니다.')).toBeNull();
  });

  it('keeps the generic status-refresh path for an ambiguous 5xx submit error', async () => {
    const refreshAfterError = vi.fn();
    model.useSeasonNftClaim.mockReturnValue(
      result({
        refreshAfterError,
        submitError: new SeasonNftRequestError(
          'Service unavailable',
          'business',
          503,
          'SERVICE_UNAVAILABLE'
        ),
        attempt: {
          attemptId: 'attempt-a',
          state: 'AWAITING_SIGNATURE',
          step: 'MINT',
          walletAddress: address,
          network: 'devnet',
          transaction: {
            transactionId: 'transaction-a',
            serializedTransactionBase64: 'AQ==',
            lastValidBlockHeight: '1',
            estimatedCostLamports: '1',
            estimatedAt: '2026-10-10T00:00:00.000Z',
          },
          errorCode: null,
          retryable: false,
        },
      })
    );
    const user = userEvent.setup();
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(
      screen.getByText(
        '거래 제출 결과를 확인하지 못했습니다. 다시 서명하기 전에 상태를 확인해 주세요.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'NFT 발행 서명' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '상태 확인' }));
    expect(refreshAfterError).toHaveBeenCalledTimes(1);
  });

  it('explains a wallet-modified transaction rejection and still requires a status refresh', async () => {
    const refreshAfterError = vi.fn();
    model.useSeasonNftClaim.mockReturnValue(
      result({
        refreshAfterError,
        submitError: new SeasonNftRequestError(
          'The signed transaction does not match the prepared transaction.',
          'business',
          400,
          'NFT_TRANSACTION_INVALID'
        ),
        attempt: {
          attemptId: 'attempt-a',
          state: 'AWAITING_SIGNATURE',
          step: 'MINT',
          walletAddress: address,
          network: 'devnet',
          transaction: {
            transactionId: 'transaction-a',
            serializedTransactionBase64: 'AQ==',
            lastValidBlockHeight: '1',
            estimatedCostLamports: '1',
            estimatedAt: '2026-10-10T00:00:00.000Z',
          },
          errorCode: null,
          retryable: false,
        },
      })
    );
    const user = userEvent.setup();
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(
      screen.getByText(
        '지갑에서 거래 내용이 변경되어 서버가 서명을 거절했습니다. 상태를 확인한 뒤 새 거래를 요청해 주세요.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'NFT 발행 서명' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '상태 확인' }));
    expect(refreshAfterError).toHaveBeenCalledTimes(1);
  });

  it('keeps signing actions unavailable while ambiguous status is refreshing', () => {
    model.useSeasonNftClaim.mockReturnValue(
      result({
        isRefreshingError: true,
        submitError: new Error('response lost'),
        attempt: {
          attemptId: 'attempt-a',
          state: 'AWAITING_SIGNATURE',
          step: 'MINT',
          walletAddress: address,
          network: 'devnet',
          transaction: {
            transactionId: 'transaction-a',
            serializedTransactionBase64: 'AQ==',
            lastValidBlockHeight: '1',
            estimatedCostLamports: '1',
            estimatedAt: '2026-10-10T00:00:00.000Z',
          },
          errorCode: null,
          retryable: false,
        },
      })
    );
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(screen.queryByRole('button', { name: 'NFT 발행 서명' })).toBeNull();
    expect(screen.getByRole('button', { name: '상태 확인' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a nonretryable failure without promising retry', () => {
    model.useSeasonNftClaim.mockReturnValue(
      result({
        attempt: {
          attemptId: 'attempt-a',
          state: 'FAILED',
          step: 'MINT',
          walletAddress: address,
          network: 'devnet',
          transaction: null,
          errorCode: 'NFT_CONFIGURATION_INVALID',
          retryable: false,
        },
      })
    );
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    expect(
      screen.getByText('현재 NFT 수령을 진행할 수 없습니다. 운영자가 상태를 확인해야 합니다.')
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
  });

  it('shows the estimate timestamp and supports Space keyboard activation', async () => {
    const sign = vi.fn();
    model.useSeasonNftClaim.mockReturnValue(
      result({
        sign,
        attempt: {
          attemptId: 'attempt-a',
          state: 'AWAITING_SIGNATURE',
          step: 'MINT',
          walletAddress: address,
          network: 'devnet',
          transaction: {
            transactionId: 'transaction-a',
            serializedTransactionBase64: 'AQ==',
            lastValidBlockHeight: '1',
            estimatedCostLamports: '1',
            estimatedAt: '2026-10-10T00:00:00.000Z',
          },
          errorCode: null,
          retryable: false,
        },
      })
    );
    const user = userEvent.setup();
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    const time = screen.getByText(/추정 시각/);
    expect(time.getAttribute('datetime')).toBe('2026-10-10T00:00:00.000Z');
    const button = screen.getByRole('button', { name: 'NFT 발행 서명' });
    button.focus();
    await user.keyboard(' ');
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it('shows a placeholder after an image load failure without changing eligibility', () => {
    render(<SeasonNftClaimCard seasonId="season-a" source="detail" />);
    fireEvent.error(screen.getByRole('img', { name: 'Season NFT' }));
    expect(screen.getByText('이미지를 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NFT 받기' })).toBeTruthy();
  });
});

describe('NFT display helpers', () => {
  it.each([
    ['0', '0'],
    ['1', '0.000000001'],
    ['1000000000', '1'],
    ['1000000001', '1.000000001'],
  ])('formats %s lamports without number precision loss', (lamports, sol) => {
    expect(lamportsToSol(lamports)).toBe(sol);
  });

  it('accepts a profile summary without fabricating full NFT fields', () => {
    const summary: SeasonNftSummary = {
      network: 'devnet',
      availability: 'PREPARING',
      reason: null,
      claim: fullView().claim,
    };
    model.useSeasonNftClaim.mockReturnValue(result({ view: summary }));
    render(<SeasonNftClaimCard seasonId="season-a" source="profile" initialSummary={summary} />);
    expect(screen.getByText('최종 NFT를 준비하고 있습니다.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
