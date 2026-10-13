import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import {
  isSnapshotPreviewUrl,
  SeasonNftRequestError,
  type SeasonNftSummary,
} from '../api/season-nft.types';
import { useSeasonNftClaim } from '../model/useSeasonNftClaim';
import { lamportsToSol } from '../lib/lamports';
import './season-nft-claim.css';

export interface SeasonNftClaimCardProps {
  seasonId: string;
  source: 'detail' | 'workspace' | 'profile';
  initialSummary?: SeasonNftSummary;
  previewImageUrl?: string | null;
  /** 사용자가 바깥의 "NFT 받기" 버튼으로 카드를 연 경우, 같은 버튼을 다시 누르지 않게 수령 준비를 한 번 시작한다. */
  autoStart?: boolean;
}

const base58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const base58Signature = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/u;

function explorerUrl(kind: 'address' | 'tx', value: string, network: 'devnet' | 'mainnet-beta') {
  const query = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}${query}`;
}

/** 세 진입점에서 같은 서버 상태와 명시적 사용자 승인 흐름을 표시한다. */
export function SeasonNftClaimCard(props: SeasonNftClaimCardProps) {
  const { t, i18n } = useTranslation('common', { keyPrefix: 'seasonNft' });
  const model = useSeasonNftClaim(props);
  const { view, attempt } = model;
  const fullImageUrl =
    view && 'imageUrl' in view && typeof view.imageUrl === 'string' ? view.imageUrl : null;
  const imageUrl =
    fullImageUrl ??
    (props.previewImageUrl && isSnapshotPreviewUrl(props.previewImageUrl)
      ? props.previewImageUrl
      : null);
  const name = view && 'name' in view && typeof view.name === 'string' ? view.name : null;
  const [imageFailure, setImageFailure] = useState<{ url: string; failed: boolean } | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const imageFailed = imageFailure?.url === imageUrl && imageFailure.failed;

  const content = useMemo(() => {
    if (!view) {
      return model.statusQuery.isError
        ? { message: t('statusError'), retryStatus: true }
        : { message: t('loading') };
    }
    if (view.claim.state === 'CLAIMED') {
      return {
        message: view.claim.receiptState === 'VERIFIED' ? t('verified') : t('resolving'),
      };
    }
    if (model.statusQuery.isError) {
      return { message: t('statusError'), retryStatus: true };
    }
    if (view.availability === 'WAITING_FOR_END') return { message: t('waitingForEnd') };
    if (view.availability === 'PREPARING') return { message: t('preparing') };
    if (view.availability === 'EMPTY') return { message: t('empty') };
    if (view.availability === 'UNAVAILABLE') {
      const reason = view.reason ?? 'FEATURE_DISABLED';
      return { message: t(`unavailable.${reason}`) };
    }
    if (view.claim.eligibility === 'NOT_PARTICIPANT') {
      return { message: t('notParticipant') };
    }
    if (view.claim.eligibility === 'NO_VALID_STROKE') {
      return { message: t('noValidStroke') };
    }
    if (model.startError && !attempt) {
      return { message: t('claimStartError'), action: 'refreshError' as const };
    }
    if (!attempt) {
      const walletMismatch = Boolean(
        view.claim.walletAddress &&
        model.session &&
        view.claim.walletAddress !== model.session.activeWallet.address
      );
      if (walletMismatch) {
        return { message: t('walletMismatch'), action: 'start' as const, disabled: true };
      }
      if (!model.support.supported) {
        return {
          message: t(
            model.support.reason === 'CHAIN_UNSUPPORTED'
              ? 'walletChainUnsupported'
              : model.support.reason === 'SIGN_TRANSACTION_UNSUPPORTED'
                ? 'walletFeatureUnsupported'
                : model.support.reason === 'ACCOUNT_AMBIGUOUS'
                  ? 'walletAmbiguous'
                  : 'walletDisconnected'
          ),
          action: 'start' as const,
          disabled: true,
        };
      }
      return view.claim.state === 'PROCESSING'
        ? { message: t('queued') }
        : { message: t('ready'), action: 'start' as const };
    }
    if (model.submitError || model.attemptQuery.isError) {
      const transactionInvalid =
        model.submitError instanceof SeasonNftRequestError &&
        model.submitError.statusCode === 400 &&
        model.submitError.code === 'NFT_TRANSACTION_INVALID';
      // 서버가 거래 변조를 명시한 경우에도 재서명보다 서버 상태 재확인을 먼저 요구한다.
      return {
        message: t(transactionInvalid ? 'transactionInvalid' : 'transactionStatusError'),
        action: 'refreshError' as const,
      };
    }
    if (attempt.state === 'QUEUED') return { message: t('queued') };
    if (attempt.state === 'SUBMITTING' || attempt.state === 'CONFIRMING') {
      return { message: t('confirming') };
    }
    if (attempt.state === 'SUCCEEDED') return { message: t('finalizing') };
    if (attempt.state === 'FAILED' || attempt.state === 'EXPIRED') {
      if (!attempt.retryable) return { message: t('nonRetryableFailure') };
      const key =
        attempt.errorCode === 'NFT_INSUFFICIENT_FUNDS' ? 'insufficientFunds' : 'retryableFailure';
      return { message: t(key), action: 'retry' as const };
    }
    if (!attempt.transaction) return { message: t('confirming') };
    const walletMismatch = Boolean(
      view.claim.walletAddress &&
      model.session &&
      view.claim.walletAddress !== model.session.activeWallet.address
    );
    if (walletMismatch) {
      return { message: t('walletMismatch'), action: 'start' as const, disabled: true };
    }
    if (!model.support.supported) {
      const reason = model.support.reason;
      return {
        message: t(
          reason === 'CHAIN_UNSUPPORTED'
            ? 'walletChainUnsupported'
            : reason === 'SIGN_TRANSACTION_UNSUPPORTED'
              ? 'walletFeatureUnsupported'
              : reason === 'ACCOUNT_AMBIGUOUS'
                ? 'walletAmbiguous'
                : 'walletDisconnected'
        ),
        action: 'sign' as const,
        disabled: true,
      };
    }
    if (model.signatureError) {
      return {
        message: t(
          model.signatureError === 'CANCELLED'
            ? 'signatureCancelled'
            : model.signatureError === 'REQUEST_PENDING'
              ? 'signaturePending'
              : model.signatureError === 'ACCOUNT_CHANGED'
                ? 'walletChanged'
                : 'signatureFailed'
        ),
        action: 'sign' as const,
      };
    }
    return { message: t('awaitingSignature'), action: 'sign' as const };
  }, [
    attempt,
    model.attemptQuery.isError,
    model.session,
    model.signatureError,
    model.startError,
    model.statusQuery.isError,
    model.submitError,
    model.support,
    t,
    view,
  ]);

  const busy = model.isStarting || model.isSigning || model.isRefreshingError;
  const transaction = attempt?.transaction ?? null;
  const claimed = view?.claim.state === 'CLAIMED';
  // 수령 준비는 서명 전 단계라 비용이 나가지 않는다. 비용은 준비가 끝난 뒤 서명 버튼 위에 표시된다.
  const canAutoStart =
    props.autoStart === true &&
    content.action === 'start' &&
    !content.disabled &&
    !busy &&
    view?.claim.state === 'UNCLAIMED';
  const autoStartedRef = useRef(false);
  const startClaim = model.startClaim;

  useEffect(() => {
    if (!canAutoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startClaim();
  }, [canAutoStart, startClaim]);

  return (
    <Card className="season-nft-card" data-source={props.source} aria-busy={busy || undefined}>
      <div className="season-nft-card__media">
        {imageUrl && !imageFailed ? (
          <img
            key={`${imageUrl}:${imageVersion}`}
            src={imageUrl}
            alt={name ?? t('imageAlt')}
            onError={() => imageUrl && setImageFailure({ url: imageUrl, failed: true })}
          />
        ) : (
          <div className="season-nft-card__placeholder">
            <ImageOff aria-hidden="true" />
            <span>{imageFailed ? t('imageError') : t('imagePending')}</span>
            {imageFailed && (
              <button
                type="button"
                onClick={() => {
                  if (imageUrl) setImageFailure({ url: imageUrl, failed: false });
                  setImageVersion(value => value + 1);
                }}
              >
                {t('imageRetry')}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="season-nft-card__body">
        <div>
          <p className="season-nft-card__eyebrow">{t('eyebrow')}</p>
          <h3>{name ?? t('title')}</h3>
        </div>
        {view?.claim.walletAddress && (
          <p className="season-nft-card__wallet">
            <span>{t('claimWallet')}</span>
            <code>{view.claim.walletAddress}</code>
          </p>
        )}
        {attempt?.state === 'AWAITING_SIGNATURE' && transaction && (
          <div className="season-nft-card__cost">
            <span>{t(attempt.step === 'ALLOWLIST_PROOF' ? 'proofCost' : 'mintCost')}</span>
            <strong>{lamportsToSol(transaction.estimatedCostLamports)} SOL</strong>
            <time dateTime={transaction.estimatedAt}>
              {t('estimatedAt', {
                value: `${new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'UTC',
                }).format(new Date(transaction.estimatedAt))} UTC`,
              })}
            </time>
            <small>{t('costDisclaimer')}</small>
            {attempt.step === 'MINT' && <small>{t('proofCostSpent')}</small>}
          </div>
        )}
        <p className="season-nft-card__status" aria-live="polite">
          {content.message}
        </p>
        {content.retryStatus && (
          <Button variant="secondary" size="sm" onClick={() => void model.statusQuery.refetch()}>
            {t('actions.refresh')}
          </Button>
        )}
        {content.action === 'refreshError' && (
          <Button
            variant="secondary"
            size="sm"
            loading={model.isRefreshingError}
            disabled={busy}
            onClick={() => void model.refreshAfterError()}
          >
            {t('actions.checkStatus')}
          </Button>
        )}
        {content.action === 'start' && (
          <Button
            variant="web3"
            size="sm"
            disabled={content.disabled || busy}
            loading={model.isStarting}
            onClick={() => void model.startClaim()}
          >
            {t('actions.claim')}
          </Button>
        )}
        {content.action === 'retry' && (
          <Button
            variant="web3"
            size="sm"
            disabled={busy}
            loading={model.isStarting}
            onClick={() => void model.startClaim()}
          >
            {t('actions.retry')}
          </Button>
        )}
        {content.action === 'sign' && attempt && (
          <Button
            variant="web3"
            size="sm"
            disabled={content.disabled || busy}
            loading={model.isSigning}
            onClick={() => void model.sign()}
          >
            {model.signatureError
              ? t('actions.signAgain')
              : t(attempt.step === 'ALLOWLIST_PROOF' ? 'actions.signProof' : 'actions.signMint')}
          </Button>
        )}
        {claimed && view?.claim.receiptState === 'VERIFIED' && (
          <div className="season-nft-card__links">
            {view.claim.assetAddress && base58Address.test(view.claim.assetAddress) && (
              <a
                href={explorerUrl('address', view.claim.assetAddress, view.network)}
                target="_blank"
                rel="noreferrer"
              >
                {t('actions.viewNft')} <ExternalLink aria-hidden="true" />
              </a>
            )}
            {view.claim.signature && base58Signature.test(view.claim.signature) && (
              <a
                href={explorerUrl('tx', view.claim.signature, view.network)}
                target="_blank"
                rel="noreferrer"
              >
                {t('actions.viewTransaction')} <ExternalLink aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
