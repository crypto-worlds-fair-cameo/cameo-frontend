import type { KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import type { CanvasHistoryItem } from '../api/history.types';
import { formatSnapshotDate, formatSnapshotTime } from '../lib/historyFormat';

interface SnapshotDialogProps {
  item?: CanvasHistoryItem;
  isLatest: boolean;
  canShowOlder: boolean;
  canShowNewer: boolean;
  isLoadingOlder: boolean;
  isDownloading: boolean;
  downloadFailed: boolean;
  onClose: () => void;
  onShowOlder: () => void;
  onShowNewer: () => void;
  onDownload: () => void;
}

export function SnapshotDialog({
  item,
  isLatest,
  canShowOlder,
  canShowNewer,
  isLoadingOlder,
  isDownloading,
  downloadFailed,
  onClose,
  onShowOlder,
  onShowNewer,
  onDownload,
}: SnapshotDialogProps) {
  const { t, i18n } = useTranslation('history');
  const date = item ? formatSnapshotDate(item.capturedAt, i18n.language) : '';
  const time = item ? formatSnapshotTime(item.capturedAt, i18n.language) : '';

  // 좌우 방향키로 시안의 Prev·Next와 같은 방향으로 이동한다.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft' && canShowOlder && !isLoadingOlder) {
      event.preventDefault();
      onShowOlder();
    } else if (event.key === 'ArrowRight' && canShowNewer) {
      event.preventDefault();
      onShowNewer();
    }
  }

  return (
    <Dialog open={item !== undefined} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="history-dialog"
        aria-describedby={undefined}
        onKeyDown={handleKeyDown}
      >
        {item && (
          <div className="history-dialog__layout">
            <div className="history-dialog__frame">
              <img
                key={item.id}
                src={item.imageUrl}
                alt={t('dialog.imageAlt', { date, time })}
                width={item.width}
                height={item.height}
                decoding="async"
              />
            </div>
            <div className="history-dialog__info">
              <p className="history-dialog__eyebrow">{t('dialog.label')}</p>
              <DialogTitle className="history-dialog__title">
                {date} · {time}
              </DialogTitle>
              {(isLatest || item.isFinal) && (
                <span className="history-badge history-badge--inline">
                  {isLatest ? t('latest') : t('final')}
                </span>
              )}
              <div className="history-dialog__actions">
                <div className="history-dialog__nav">
                  <Button
                    variant="secondary"
                    title={t('dialog.previousHint')}
                    disabled={!canShowOlder || isLoadingOlder}
                    onClick={onShowOlder}
                  >
                    <ArrowLeft aria-hidden="true" />
                    {isLoadingOlder ? t('loadingMore') : t('dialog.previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    title={t('dialog.nextHint')}
                    disabled={!canShowNewer}
                    onClick={onShowNewer}
                  >
                    {t('dialog.next')}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
                <Button
                  className="history-dialog__download"
                  disabled={isDownloading}
                  onClick={onDownload}
                >
                  {isDownloading ? t('dialog.downloading') : t('dialog.download')}
                </Button>
                {downloadFailed && (
                  <p className="history-dialog__hint" role="status">
                    {t('dialog.downloadFailed')}{' '}
                    <a href={item.imageUrl} target="_blank" rel="noopener noreferrer">
                      {t('dialog.openImage')}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
