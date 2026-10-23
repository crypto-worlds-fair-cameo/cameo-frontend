import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
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
  const preview = quote ?? loaded;

  if (loaded && draftSeasonId !== loaded.seasonId) {
    setDraftSeasonId(loaded.seasonId);
    setDescription(loaded.description);
    setSupply(loaded.supply);
    setQuote(null);
    setStep('info');
  }

  const close = () => {
    if (step === 'minting') return;
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
          await submitSeasonNftMintTransaction(seasonId, {
            transactionId: pending.transactionId,
            signedTransactionBase64: signed,
          });
        } else {
          await wait(2000);
        }
        current = await getSeasonNftMintPreview(seasonId);
        setQuote(current);
      }
      setStep(current.status === 'READY' ? 'success' : 'failure');
    } catch (cause: unknown) {
      setError(cause instanceof SeasonRequestError ? cause.message : t('detail.error'));
      setStep('failure');
    }
  };

  const minted = preview?.mintedCount ?? '0';

  return (
    <Dialog open={open} onOpenChange={next => (next ? onOpenChange(true) : close())}>
      <DialogContent className="season-management-dialog" showCloseButton={step !== 'minting'}>
        <div className="season-management-body">
          {step === 'info' && (
            <>
              <DialogTitle>{t('workspace.mint.infoTitle')}</DialogTitle>
              <DialogDescription>
                {preview
                  ? `${t('workspace.mint.period')} ${formatSeasonDateRange(preview.startsAt, preview.endsAt, i18n.language)}`
                  : t('detail.loading')}
              </DialogDescription>
              {preview && (
                <>
                  <p>{t('workspace.mint.participants', { count: preview.eligibleCount })}</p>
                  <p>{t('workspace.mint.strokes', { count: preview.strokeCount })}</p>
                </>
              )}
              {(error || previewQuery.isError) && <p role="alert">{error ?? t('detail.error')}</p>}
              <Button
                className="season-management-button"
                disabled={!preview}
                onClick={() => setStep('supply')}
              >
                {t('workspace.mint.next')}
              </Button>
            </>
          )}
          {step === 'supply' && preview && (
            <>
              <DialogTitle>{t('workspace.mint.supplyTitle')}</DialogTitle>
              <label>
                {t('workspace.mint.description')}
                <textarea
                  value={description}
                  maxLength={1000}
                  placeholder={t('workspace.mint.descriptionPlaceholder')}
                  onChange={event => setDescription(event.target.value)}
                />
              </label>
              <label>
                {t('workspace.mint.supply')}
                <Input
                  inputMode="numeric"
                  value={supply}
                  onChange={event => setSupply(event.target.value.replace(/[^\d]/g, ''))}
                />
              </label>
              <p>{t('workspace.mint.supplyHint', { count: preview.minSupply })}</p>
              {error && <p role="alert">{error}</p>}
              <Button
                className="season-management-button"
                loading={loading}
                onClick={() => void goConfirm()}
              >
                {t('workspace.mint.next')}
              </Button>
            </>
          )}
          {step === 'confirm' && preview && (
            <>
              <DialogTitle>{t('workspace.mint.confirmTitle')}</DialogTitle>
              {preview.imageUrl && <img src={preview.imageUrl} alt="" width={160} height={160} />}
              <p>
                {t('workspace.mint.supply')} {preview.supply}
              </p>
              <p>
                {t('workspace.mint.network')} {preview.network}
              </p>
              <p>
                {t('workspace.mint.wallet')} {preview.walletAddress}
              </p>
              <p>
                {t('workspace.mint.fee')}{' '}
                {preview.estimatedLamports
                  ? `${formatSol(preview.estimatedLamports)} SOL`
                  : t('workspace.mint.feeUnknown')}
              </p>
              <p>{t('workspace.mint.signatures', { count: preview.signatureCount })}</p>
              {error && <p role="alert">{error}</p>}
              <Button className="season-management-button" onClick={() => void mint()}>
                {t('workspace.mint.sign')}
              </Button>
              <Button variant="secondary" className="season-management-button" onClick={close}>
                {t('workspace.mint.cancel')}
              </Button>
            </>
          )}
          {step === 'minting' && (
            <>
              <DialogTitle>{t('workspace.mint.minting')}</DialogTitle>
              <p role="status">
                {t('workspace.mint.progress', {
                  minted: preview?.mintedCount ?? '0',
                  total: preview?.creatorAllocation ?? supply,
                })}
              </p>
            </>
          )}
          {step === 'success' && (
            <>
              <DialogTitle>{t('workspace.mint.successTitle')}</DialogTitle>
              {preview?.collectionAddress && (
                <Button variant="secondary" asChild className="season-management-button">
                  <a
                    href={`https://explorer.solana.com/address/${encodeURIComponent(preview.collectionAddress)}${preview.network === 'devnet' ? '?cluster=devnet' : ''}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('workspace.mint.viewNft')}
                  </a>
                </Button>
              )}
            </>
          )}
          {step === 'failure' && (
            <>
              <DialogTitle>{t('workspace.mint.failureTitle')}</DialogTitle>
              <DialogDescription>
                {minted === '0'
                  ? t('workspace.mint.failureBody')
                  : t('workspace.mint.failureResume')}
              </DialogDescription>
              {error && <p role="alert">{error}</p>}
              <Button className="season-management-button" onClick={() => void mint()}>
                {t('workspace.mint.retry')}
              </Button>
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
      <DialogContent className="season-management-dialog" showCloseButton={false}>
        <div className="season-management-body">
          <DialogTitle>{t('workspace.mint.endedTitle')}</DialogTitle>
          <DialogDescription>{t('workspace.mint.endedBody')}</DialogDescription>
          <Button className="season-management-button" onClick={onCreate}>
            {t('workspace.createNft')}
          </Button>
          <Button variant="secondary" className="season-management-button" onClick={onLater}>
            {t('workspace.mint.later')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
