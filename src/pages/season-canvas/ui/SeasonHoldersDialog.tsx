import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { useSeasonHoldersQuery } from '../api/seasons.queries';
import type { SeasonHolder } from '../api/seasons.types';
import './season-holders-dialog.css';

/** 시안(N6)이 한 쪽에 네 줄을 보여 주므로 쪽 크기를 맞춘다. 끝난 방 패널도 같은 첫 쪽 캐시를 쓴다. */
export const SEASON_HOLDERS_PAGE_SIZE = 4;
const SEARCH_DELAY_MS = 300;
const VISIBLE_PAGE_COUNT = 5;

interface SeasonHoldersDialogProps {
  open: boolean;
  seasonId: string;
  title: string;
  sessionKey: string | undefined;
  onOpenChange: (open: boolean) => void;
}

/** 개설자와 목록 대상 참가자의 시즌 NFT 수령 수량을 검색·쪽 단위로 보여 준다. 닫으면 검색어와 쪽을 버린다. */
export function SeasonHoldersDialog({
  open,
  seasonId,
  title,
  sessionKey,
  onOpenChange,
}: SeasonHoldersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="season-holders-dialog" showCloseButton={false}>
        <SeasonHoldersContent seasonId={seasonId} title={title} sessionKey={sessionKey} />
      </DialogContent>
    </Dialog>
  );
}

function SeasonHoldersContent({
  seasonId,
  title,
  sessionKey,
}: Pick<SeasonHoldersDialogProps, 'seasonId' | 'title' | 'sessionKey'>) {
  const { t } = useTranslation('seasonCanvas');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useSeasonHoldersQuery(
    sessionKey,
    seasonId,
    { page, limit: SEASON_HOLDERS_PAGE_SIZE, search },
    true
  );
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const timer = window.setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  return (
    <>
      <div className="season-holders-header">
        <DialogTitle>{t('holders.title', { title })}</DialogTitle>
        <DialogCloseButton />
      </div>
      <DialogDescription className="sr-only">{t('holders.description')}</DialogDescription>
      <label className="season-holders-search">
        <Search aria-hidden="true" />
        <span className="sr-only">{t('holders.searchLabel')}</span>
        <Input
          type="search"
          value={searchInput}
          maxLength={50}
          placeholder={t('holders.search')}
          onChange={event => setSearchInput(event.target.value)}
        />
      </label>
      {!data ? (
        query.isError ? (
          <div className="season-holders-message" role="alert">
            <p>{t('holders.error')}</p>
            <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <p className="season-holders-message" role="status">
            {t('holders.loading')}
          </p>
        )
      ) : data.items.length === 0 ? (
        <p className="season-holders-message" role="status">
          {t(search ? 'holders.noResults' : 'holders.empty')}
        </p>
      ) : (
        <>
          <ul className="season-holders-list" aria-busy={query.isFetching || undefined}>
            {data.items.map(holder => (
              <SeasonHolderRow key={holder.walletAddress} holder={holder} />
            ))}
          </ul>
          <nav className="season-holders-pages" aria-label={t('holders.pages')}>
            {visiblePages(page, totalPages).map(number => (
              <button
                key={number}
                type="button"
                aria-label={t('holders.page', { page: number })}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}
          </nav>
        </>
      )}
      {data && query.isError && (
        <p className="season-holders-error" role="alert">
          {t('holders.error')}
        </p>
      )}
    </>
  );
}

function SeasonHolderRow({ holder }: { holder: SeasonHolder }) {
  const { t } = useTranslation('seasonCanvas');
  return (
    <li className="season-holders-row">
      <div>
        <span>{t('holders.owner')}</span>
        <span title={holder.displayName ?? holder.walletAddress}>
          {holder.displayName ?? shortenAddress(holder.walletAddress)}
        </span>
      </div>
      <div>
        <span>{t('holders.walletAddress')}</span>
        <span title={holder.walletAddress}>{holder.walletAddress}</span>
      </div>
      <div>
        <span>{t('holders.amount')}</span>
        <span>{holder.amount ?? t('holders.notIssued')}</span>
      </div>
    </li>
  );
}

function shortenAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function visiblePages(current: number, total: number) {
  const count = Math.min(VISIBLE_PAGE_COUNT, total);
  const start = Math.min(Math.max(1, current - Math.floor(count / 2)), total - count + 1);
  return Array.from({ length: count }, (_, index) => start + index);
}
