import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { formatWalletAddress } from '@/app/layout/header/lib/formatWalletAddress';
import { signSolanaTransactions } from '@/shared/lib/solana-wallet/sign-transaction';
import { getWalletBalance } from '@/pages/profile/api/profile.api';
import { formatSeasonDateRange } from '../lib/seasonDate';
import { formatSol } from '../lib/seasonForm';
import { SeasonRequestError } from '../api/seasons.types';
import {
  getSeasonNftMintPreview,
  requestSeasonNftMint,
  submitSeasonNftMintTransaction,
  type SeasonNftMintPendingTransaction,
  type SeasonNftMintPreview,
} from '../api/season-nft-mint';
import './season-management-dialogs.css';
import './season-nft-mint-dialog.css';

const MAX_CREATOR_ALLOCATION = 65_535;

type MintStep = 'info' | 'supply' | 'confirm' | 'minting' | 'success' | 'failure';

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pendingOf(current: SeasonNftMintPreview): SeasonNftMintPendingTransaction[] {
  if (current.pendingTransactions) return current.pendingTransactions;
  return current.pendingTransaction ? [current.pendingTransaction] : [];
}

function sameSupply(left: string, right: string): boolean {
  if (!/^[1-9][0-9]*$/u.test(left) || !/^[1-9][0-9]*$/u.test(right)) return false;
  return BigInt(left) === BigInt(right);
}

function samePending(
  left: readonly SeasonNftMintPendingTransaction[],
  right: readonly SeasonNftMintPendingTransaction[]
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item.transactionId === right[index]?.transactionId)
  );
}

/** 아직 하나도 발행하지 않았고 수수료를 알고 있을 때만 잔액과 비교한다. */
function blocksUnstartedMint(input: {
  fee: string | null | undefined;
  minted: string;
  balanceLamports: string | undefined;
  sameWallet: boolean;
}): boolean {
  if (
    !input.fee ||
    input.minted !== '0' ||
    !input.sameWallet ||
    input.balanceLamports === undefined
  ) {
    return false;
  }
  return BigInt(input.balanceLamports) < BigInt(input.fee);
}

/** 끝난 시즌의 개설자가 수량을 고르고, 자기 지갑으로 발행 거래에 서명한다. */
export function SeasonNftMintDialog({
  open,
  seasonId,
  walletAddress,
  onOpenChange,
}: {
  open: boolean;
  seasonId: string;
  walletAddress: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation('seasonCanvas');
  const previewQuery = useQuery({
    queryKey: ['season-nft-mint', seasonId],
    enabled: open,
    queryFn: () => getSeasonNftMintPreview(seasonId),
  });
  const loaded = previewQuery.data ?? null;
  const [step, setStep] = useState<MintStep>('info');
  const [quote, setQuote] = useState<SeasonNftMintPreview | null>(null);
  const [draftSeasonId, setDraftSeasonId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [supply, setSupply] = useState('');
  // 입력 중에 서버 수량이 다시 도착해도 방금 친 숫자를 덮지 않는다.
  const supplyRef = useRef('');
  const supplyTouched = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<SeasonNftMintPendingTransaction[]>([]);
  const [signing, setSigning] = useState(false);
  // 발행 반복마다 번호를 매겨, 창을 닫으면 진행 중인 반복이 지갑 서명을 더 요청하지 않게 한다.
  const runRef = useRef(0);
  const promptRef = useRef<SeasonNftMintPendingTransaction[]>([]);
  const signingRef = useRef(false);
  const signedIds = useRef(new Set<string>());
  const preview = quote ?? loaded;
  const balanceQuery = useQuery({
    queryKey: ['profile', 'balance', walletAddress],
    enabled: open && walletAddress.length > 0,
    retry: false,
    queryFn: ({ signal }) => getWalletBalance(signal),
  });
  const balance = balanceQuery.data;
  const sameWallet =
    balance !== undefined &&
    preview !== null &&
    balance.network === preview.network &&
    balance.walletAddress === walletAddress;
  const balanceApplies =
    preview?.estimatedLamports != null &&
    (preview.mintedCount ?? '0') === '0' &&
    (step === 'confirm' || step === 'failure');
  const checkingBalance = balanceApplies && balanceQuery.isPending;
  const balanceUnavailable =
    balanceApplies && (balanceQuery.isError || (balanceQuery.isSuccess && !sameWallet));
  const insufficientSol =
    balanceApplies &&
    blocksUnstartedMint({
      fee: preview?.estimatedLamports,
      minted: preview?.mintedCount ?? '0',
      balanceLamports: balance?.lamports,
      sameWallet,
    });
  const mintBlocked = checkingBalance || balanceUnavailable || insufficientSol;

  if (loaded && draftSeasonId !== loaded.seasonId) {
    const switchingSeason = draftSeasonId !== null;
    setDraftSeasonId(loaded.seasonId);
    setDescription(loaded.description);
    if (switchingSeason || !supplyTouched.current) {
      supplyTouched.current = false;
      supplyRef.current = loaded.supply;
      setSupply(loaded.supply);
    }
    setQuote(null);
    setStep('info');
  }

  const close = () => {
    // 발행 중에 닫으면 반복을 멈추고 확인 단계로 돌려 둔다. 다시 서명하면 서버에 남은 단계부터 이어진다.
    runRef.current += 1;
    promptRef.current = [];
    setPrompt([]);
    setSigning(false);
    setError(null);
    if (step === 'minting') setStep('confirm');
    else if (step === 'confirm' && (preview?.mintedCount ?? '0') === '0') {
      // 서명을 시작하기 전에 닫으면 다음 열 때 예전 확인 화면이 아니라 수량 입력으로 연다.
      setQuote(null);
      setStep('supply');
    }
    onOpenChange(false);
  };

  const backToSupply = () => {
    setQuote(null);
    setError(null);
    setStep('supply');
  };

  const allocationTooLarge = () => {
    if (!preview || !/^[1-9][0-9]*$/u.test(supply)) return false;
    return BigInt(supply) - BigInt(preview.minSupply) + 1n > BigInt(MAX_CREATOR_ALLOCATION);
  };
  const supplyTooSmall = () => {
    if (!preview || !/^[1-9][0-9]*$/u.test(supply)) return true;
    return BigInt(supply) < BigInt(preview.minSupply);
  };

  const goConfirm = async () => {
    if (!preview || supplyTooSmall()) {
      setError(t('workspace.mint.supplyHint', { count: preview?.minSupply ?? '1' }));
      return;
    }
    if (allocationTooLarge()) {
      setError(t('workspace.mint.allocationLimit'));
      return;
    }
    const requested = supplyRef.current;
    setLoading(true);
    setError(null);
    setQuote(null);
    try {
      const next = await getSeasonNftMintPreview(seasonId, requested);
      if (!sameSupply(next.supply, requested)) {
        setError(t('workspace.mint.supplyNotApplied'));
        return;
      }
      setQuote(next);
      setStep('confirm');
    } catch (cause: unknown) {
      setError(cause instanceof SeasonRequestError ? cause.message : t('detail.error'));
    } finally {
      setLoading(false);
    }
  };

  const mint = async () => {
    if (!preview || mintBlocked) return;
    const run = ++runRef.current;
    const stopped = () => runRef.current !== run;
    setStep('minting');
    setError(null);
    signedIds.current = new Set();
    promptRef.current = [];
    setPrompt([]);
    try {
      const requested = supplyRef.current;
      let current = await requestSeasonNftMint(seasonId, {
        supply: requested,
        description: description.trim() || undefined,
      });
      if (!sameSupply(current.supply, requested)) {
        setError(t('workspace.mint.supplyNotApplied'));
        setStep('supply');
        return;
      }
      setQuote(current);
      for (let attempt = 0; attempt < 900 && current.status !== 'READY'; attempt += 1) {
        if (stopped()) return;
        if (current.status === 'BLOCKED' || current.status === 'EMPTY') {
          setQuote(current);
          setStep('failure');
          return;
        }
        const pending = pendingOf(current).filter(
          item => !signedIds.current.has(item.transactionId)
        );
        if (pending.length > 0) {
          if (!samePending(promptRef.current, pending)) {
            promptRef.current = pending;
            setPrompt(pending);
          }
        } else if (promptRef.current.length > 0) {
          promptRef.current = [];
          setPrompt([]);
        }
        await wait(2000);
        if (stopped()) return;
        const next = await getSeasonNftMintPreview(seasonId, supplyRef.current);
        if (!sameSupply(next.supply, supplyRef.current)) continue;
        current = next;
        setQuote(current);
      }
      if (stopped()) return;
      setStep(current.status === 'READY' ? 'success' : 'failure');
    } catch (cause: unknown) {
      if (stopped()) return;
      setError(cause instanceof SeasonRequestError ? cause.message : t('detail.error'));
      setStep('failure');
    }
  };

  const signPrompt = async () => {
    const pending = promptRef.current;
    const run = runRef.current;
    const network = (quote ?? loaded)?.network;
    if (pending.length === 0 || !network || signingRef.current) return;
    signingRef.current = true;
    setSigning(true);
    setError(null);
    try {
      const signed = await signSolanaTransactions({
        walletAddress,
        network,
        serializedTransactionsBase64: pending.map(item => item.serializedTransactionBase64),
      });
      if (runRef.current !== run) return;
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index];
        if (!item) continue;
        try {
          await submitSeasonNftMintTransaction(seasonId, {
            transactionId: item.transactionId,
            signedTransactionBase64: signed[index] ?? '',
          });
        } catch (cause: unknown) {
          if (!(cause instanceof SeasonRequestError) || cause.code !== 'NFT_TRANSACTION_EXPIRED') {
            throw cause;
          }
        }
        signedIds.current.add(item.transactionId);
      }
      if (runRef.current !== run) return;
      if (samePending(promptRef.current, pending)) {
        promptRef.current = [];
        setPrompt([]);
      }
    } catch (cause: unknown) {
      if (runRef.current !== run) return;
      const remaining = promptRef.current.filter(
        item => !signedIds.current.has(item.transactionId)
      );
      promptRef.current = remaining;
      setPrompt(remaining);
      // 서버가 거절한 사유는 그대로 보여 주고, 그 밖은 지갑이 서명을 돌려주지 않은 경우다.
      setError(
        cause instanceof SeasonRequestError ? cause.message : t('workspace.mint.signFailed')
      );
    } finally {
      signingRef.current = false;
      if (runRef.current === run) setSigning(false);
    }
  };

  const minted = preview?.mintedCount ?? '0';
  const period = preview
    ? formatSeasonDateRange(preview.startsAt, preview.endsAt, i18n.language)
    : '';

  return (
    <Dialog open={open} onOpenChange={next => (next ? onOpenChange(true) : close())}>
      <DialogContent className="season-management-dialog nft-mint-dialog" showCloseButton={false}>
        <div className="nft-mint">
          {step === 'info' && (
            <>
              <button type="button" className="nft-mint__back" onClick={close}>
                <span aria-hidden="true">←</span>
                {t('workspace.createNft')}
              </button>
              <DialogTitle>
                {preview
                  ? t('workspace.mint.infoHeading', { title: preview.title })
                  : t('detail.loading')}
              </DialogTitle>
              {preview && (
                <div className="nft-mint__rows">
                  <div className="nft-mint__row">
                    <span>{t('workspace.mint.durationLabel')}</span>
                    <span>{period}</span>
                  </div>
                  <div className="nft-mint__row">
                    <span>{t('workspace.mint.participantsLabel')}</span>
                    <span>{preview.eligibleCount}</span>
                  </div>
                </div>
              )}
              {(error || previewQuery.isError) && (
                <p className="nft-mint__error" role="alert">
                  {error ?? t('detail.error')}
                </p>
              )}
              <div className="nft-mint__actions">
                <Button
                  variant="secondary"
                  className="season-management-button"
                  disabled={!preview}
                  onClick={() => setStep('supply')}
                >
                  {t('workspace.mint.next')}
                </Button>
                <Button className="season-management-button" onClick={close}>
                  {t('workspace.mint.cancel')}
                </Button>
              </div>
            </>
          )}
          {step === 'supply' && preview && (
            <>
              <button type="button" className="nft-mint__back" onClick={() => setStep('info')}>
                <span aria-hidden="true">←</span>
                {t('workspace.createNft')}
              </button>
              <DialogTitle>{t('workspace.mint.infoHeading', { title: preview.title })}</DialogTitle>
              <p className="nft-mint__date">{period}</p>
              <label className="nft-mint__field">
                <span>{t('workspace.mint.description')}</span>
                <textarea
                  value={description}
                  maxLength={1000}
                  placeholder={preview.description || t('workspace.mint.descriptionPlaceholder')}
                  onChange={event => setDescription(event.target.value)}
                />
              </label>
              <div className="nft-mint__rows">
                <div className="nft-mint__row">
                  <span>{t('workspace.mint.totalStrokes')}</span>
                  <span>{preview.strokeCount}</span>
                </div>
                <div className="nft-mint__row">
                  <label htmlFor="nft-mint-supply">{t('workspace.mint.supply')}</label>
                  <Input
                    id="nft-mint-supply"
                    inputMode="numeric"
                    value={supply}
                    onChange={event => {
                      const next = event.target.value.replace(/[^\d]/g, '');
                      supplyTouched.current = true;
                      supplyRef.current = next;
                      setSupply(next);
                    }}
                  />
                </div>
              </div>
              {error && (
                <p className="nft-mint__error" role="alert">
                  {error}
                </p>
              )}
              <div className="nft-mint__actions">
                <Button
                  className="season-management-button"
                  loading={loading}
                  onClick={() => void goConfirm()}
                >
                  {t('workspace.createNft')}
                </Button>
                <Button variant="secondary" className="season-management-button" onClick={close}>
                  {t('workspace.mint.cancel')}
                </Button>
              </div>
            </>
          )}
          {(step === 'confirm' || step === 'minting' || step === 'success' || step === 'failure') &&
            preview && (
              <>
                <div className="nft-mint__heading">
                  <button
                    type="button"
                    className="nft-mint__back"
                    onClick={step === 'confirm' ? backToSupply : close}
                  >
                    <span aria-hidden="true">←</span>
                    {t('workspace.createNft')}
                  </button>
                  {preview.step != null && preview.step >= 1 && preview.signatureCount >= 1 && (
                    <p className="nft-mint__step">
                      {t('workspace.mint.step', {
                        current: preview.step,
                        total: preview.signatureCount,
                      })}
                    </p>
                  )}
                </div>
                <DialogTitle>
                  {step === 'failure'
                    ? t('workspace.mint.failureTitle')
                    : t('workspace.mint.confirmTitle')}
                </DialogTitle>
                {preview.imageUrl && (
                  <img className="nft-mint__preview" src={preview.imageUrl} alt="" />
                )}
                <div className="nft-mint__rows">
                  <div className="nft-mint__row">
                    <span>{t('workspace.mint.supply')}</span>
                    <span>{minted === '0' ? supply : preview.supply}</span>
                  </div>
                  <div className="nft-mint__row">
                    <span>{t('workspace.info')}</span>
                    <span>{preview.title}</span>
                  </div>
                  <div className="nft-mint__row">
                    <span>{t('workspace.mint.network')}</span>
                    <span>
                      {preview.network === 'devnet'
                        ? t('workspace.mint.networkNameDevnet')
                        : t('workspace.mint.networkName')}
                    </span>
                  </div>
                  <div className="nft-mint__row">
                    <span>{t('workspace.mint.wallet')}</span>
                    <span>Phantom {formatWalletAddress(preview.walletAddress)}</span>
                  </div>
                </div>
                <div className="nft-mint__row nft-mint__fee">
                  <span>{t('workspace.mint.fee')}</span>
                  <span>
                    {preview.estimatedLamports
                      ? `${formatSol(preview.estimatedLamports)} SOL`
                      : t('workspace.mint.feeUnknown')}
                  </span>
                </div>
                {step === 'success' && (
                  <p className="nft-mint__status">{t('workspace.mint.successBody')}</p>
                )}
                {step === 'failure' && (
                  <p className="nft-mint__status nft-mint__status--failure" role="alert">
                    {minted === '0'
                      ? t('workspace.mint.failureBody')
                      : t('workspace.mint.failureResume')}
                  </p>
                )}
                {(insufficientSol || balanceUnavailable) && (
                  <p className="nft-mint__error" role="alert">
                    {insufficientSol
                      ? t('workspace.mint.insufficientSol')
                      : t('workspace.mint.balanceUnavailable')}
                  </p>
                )}
                {error && step !== 'success' && (
                  <p className="nft-mint__error" role="alert">
                    {error}
                  </p>
                )}
                <div className="nft-mint__actions">
                  {step === 'confirm' && (
                    <Button
                      variant="web3"
                      className="season-management-button"
                      disabled={mintBlocked}
                      onClick={() => void mint()}
                    >
                      {t('workspace.mint.sign')}
                    </Button>
                  )}
                  {step === 'minting' && prompt.length > 0 && (
                    <Button
                      variant="web3"
                      className="season-management-button"
                      disabled={signing}
                      onClick={() => void signPrompt()}
                    >
                      {prompt.length > 1
                        ? t('workspace.mint.confirmInWalletCount', { count: prompt.length })
                        : t('workspace.mint.confirmInWallet')}
                    </Button>
                  )}
                  {step === 'minting' && prompt.length === 0 && (
                    <Button
                      variant="web3"
                      className="season-management-button"
                      disabled
                      aria-busy="true"
                    >
                      {t('workspace.mint.minting')}
                    </Button>
                  )}
                  {step === 'success' && preview.collectionAddress && (
                    <Button asChild className="season-management-button">
                      <a
                        href={`https://explorer.solana.com/address/${encodeURIComponent(preview.collectionAddress)}${preview.network === 'devnet' ? '?cluster=devnet' : ''}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('workspace.mint.viewNft')}
                      </a>
                    </Button>
                  )}
                  {step === 'failure' && (
                    <Button
                      variant="web3"
                      className="season-management-button"
                      disabled={mintBlocked}
                      onClick={() => void mint()}
                    >
                      {t('workspace.mint.retry')}
                    </Button>
                  )}
                  {step !== 'success' && (
                    <Button
                      variant="secondary"
                      className="season-management-button"
                      onClick={step === 'confirm' && minted === '0' ? backToSupply : close}
                    >
                      {t('workspace.mint.cancel')}
                    </Button>
                  )}
                </div>
              </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 끝난 방에 처음 들어오면 발행 여부를 한 번만 묻는다. */
export function SeasonNftEndedPrompt({
  open,
  onLater,
  onCreate,
}: {
  open: boolean;
  onLater: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('seasonCanvas');
  return (
    <Dialog open={open} onOpenChange={next => !next && onLater()}>
      <DialogContent className="nft-ended-dialog" showCloseButton={false}>
        <DialogTitle>{t('workspace.mint.endedTitle')}</DialogTitle>
        <div className="nft-ended__actions">
          <Button variant="secondary" onClick={onLater}>
            {t('workspace.mint.later')}
          </Button>
          <Button onClick={onCreate}>{t('workspace.createNft')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
