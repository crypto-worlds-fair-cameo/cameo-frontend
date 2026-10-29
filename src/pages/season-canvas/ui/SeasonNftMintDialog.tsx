import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { formatWalletAddress } from '@/app/layout/header/lib/formatWalletAddress';
import { signSolanaTransaction } from '@/shared/lib/solana-wallet/sign-transaction';
import { formatSeasonDateRange } from '../lib/seasonDate';
import { formatSol } from '../lib/seasonForm';
import { SeasonRequestError } from '../api/seasons.types';
import {
  getSeasonNftMintPreview,
  requestSeasonNftMint,
  submitSeasonNftMintTransaction,
  type SeasonNftMintPreview,
} from '../api/season-nft-mint';
import './season-management-dialogs.css';
import './season-nft-mint-dialog.css';

const MAX_CREATOR_ALLOCATION = 65_535;

type MintStep = 'info' | 'supply' | 'confirm' | 'minting' | 'success' | 'failure';

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 발행 반복마다 번호를 매겨, 창을 닫으면 진행 중인 반복이 지갑 서명을 더 요청하지 않게 한다.
  const runRef = useRef(0);
  const preview = quote ?? loaded;

  if (loaded && draftSeasonId !== loaded.seasonId) {
    setDraftSeasonId(loaded.seasonId);
    setDescription(loaded.description);
    setSupply(loaded.supply);
    setQuote(null);
    setStep('info');
  }

  const close = () => {
    // 발행 중에 닫으면 반복을 멈추고 확인 단계로 돌려 둔다. 다시 서명하면 서버에 남은 단계부터 이어진다.
    runRef.current += 1;
    if (step === 'minting') setStep('confirm');
    onOpenChange(false);
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
    setLoading(true);
    setError(null);
    try {
      setQuote(await getSeasonNftMintPreview(seasonId, supply));
      setStep('confirm');
    } catch (cause: unknown) {
      setError(cause instanceof SeasonRequestError ? cause.message : t('detail.error'));
    } finally {
      setLoading(false);
    }
  };

  const mint = async () => {
    if (!preview) return;
    const run = ++runRef.current;
    const stopped = () => runRef.current !== run;
    setStep('minting');
    setError(null);
    const seen = new Set<string>();
    try {
      let current = await requestSeasonNftMint(seasonId, {
        supply,
        description: description.trim() || undefined,
      });
      setQuote(current);
      for (let attempt = 0; attempt < 200 && current.status !== 'READY'; attempt += 1) {
        if (stopped()) return;
        if (current.status === 'BLOCKED' || current.status === 'EMPTY') {
          setQuote(current);
          setStep('failure');
          return;
        }
        const pending = current.pendingTransaction;
        if (pending && !seen.has(pending.transactionId)) {
          seen.add(pending.transactionId);
          const signed = await signSolanaTransaction({
            walletAddress,
            network: current.network,
            serializedTransactionBase64: pending.serializedTransactionBase64,
          });
          if (stopped()) return;
          try {
            await submitSeasonNftMintTransaction(seasonId, {
              transactionId: pending.transactionId,
              signedTransactionBase64: signed,
            });
          } catch (cause: unknown) {
            if (!(cause instanceof SeasonRequestError) || cause.code !== 'NFT_TRANSACTION_EXPIRED')
              throw cause;
          }
        } else {
          await wait(2000);
        }
        if (stopped()) return;
        current = await getSeasonNftMintPreview(seasonId);
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
                    onChange={event => setSupply(event.target.value.replace(/[^\d]/g, ''))}
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
                <button
                  type="button"
                  className="nft-mint__back"
                  onClick={step === 'confirm' ? () => setStep('supply') : close}
                >
                  <span aria-hidden="true">←</span>
                  {t('workspace.createNft')}
                </button>
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
                    <span>{preview.supply}</span>
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
                <div className="nft-mint__actions">
                  {step === 'confirm' && (
                    <Button
                      variant="web3"
                      className="season-management-button"
                      onClick={() => void mint()}
                    >
                      {t('workspace.mint.sign')}
                    </Button>
                  )}
                  {step === 'minting' && (
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
                      onClick={() => void mint()}
                    >
                      {t('workspace.mint.retry')}
                    </Button>
                  )}
                  {step !== 'success' && (
                    <Button
                      variant="secondary"
                      className="season-management-button"
                      onClick={close}
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
