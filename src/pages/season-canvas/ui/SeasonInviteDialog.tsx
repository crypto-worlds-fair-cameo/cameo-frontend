import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import type { Season } from '../api/seasons.types';
import { formatSeasonDateRange } from '../lib/seasonDate';
import './season-management-dialogs.css';

interface SeasonInviteDialogProps {
  open: boolean;
  season: Pick<Season, 'id' | 'title' | 'endsAt'>;
  onOpenChange: (open: boolean) => void;
}

/** 현재 공개 작업 공간 주소를 공유하며 닫힌 초대창의 늦은 복사 결과는 버린다. */
export function SeasonInviteDialog({ open, season, onOpenChange }: SeasonInviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="season-management-dialog season-invite-dialog"
        showCloseButton={false}
      >
        <SeasonInviteContent season={season} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SeasonInviteContent({
  season,
  onDone,
}: {
  season: SeasonInviteDialogProps['season'];
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation('seasonCanvas');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copying, setCopying] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(false);
  const link = new URL(`/season-canvas/${encodeURIComponent(season.id)}`, window.location.origin)
    .href;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const copyLink = async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    setCopying(true);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(link);
      if (mountedRef.current) setCopied(true);
    } catch {
      if (mountedRef.current) {
        setCopied(false);
        setCopyFailed(true);
      }
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setCopying(false);
    }
  };

  return (
    <div className="season-management-body">
      <DialogTitle>{t('invite.title', { title: season.title })}</DialogTitle>
      <div className="season-invite-link">
        <Input
          aria-label={t('invite.linkLabel')}
          value={link}
          readOnly
          onFocus={event => event.target.select()}
        />
        <Button
          className="season-invite-copy"
          data-copied={copied}
          disabled={copying}
          onClick={() => void copyLink()}
        >
          {t(copied ? 'invite.copied' : 'invite.copy')}
        </Button>
      </div>
      <DialogDescription className="season-invite-description">
        {t('invite.description', {
          date: formatSeasonDateRange(season.endsAt, season.endsAt, i18n.language),
        })}
      </DialogDescription>
      {copyFailed && (
        <p className="season-management-error" role="alert">
          {t('invite.copyError')}
        </p>
      )}
      <span className="sr-only" role="status">
        {copied ? t('invite.copied') : ''}
      </span>
      <div className="season-invite-spacer" aria-hidden="true" />
      <Button className="season-management-button" onClick={onDone}>
        {t('invite.done')}
      </Button>
    </div>
  );
}
