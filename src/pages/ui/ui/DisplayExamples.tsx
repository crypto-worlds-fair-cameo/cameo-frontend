import { UserRound } from 'lucide-react';
import { MediaCard, ProfileCard, InfoCard, StatsCard } from '@/shared/ui/card';
import { MediaListItem, DataRow } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Demo } from './CatalogSection';

function CanvasArtwork({ alternate = false }: { alternate?: boolean }) {
  return (
    <div
      className={`catalog-artwork${alternate ? ' catalog-artwork--alternate' : ''}`}
      role="img"
      aria-label="색면으로 구성한 시즌 캔버스 예시"
    >
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
export function CardExamples() {
  return (
    <>
      <h3 className="catalog-group-title">CARDS & PANELS</h3>
      <div className="catalog-demo-grid">
        <Demo title="11 · Season Card" spec="MediaCard · 이미지 Border 1px · 데이터 전용 폰트">
          <MediaCard media={<CanvasArtwork />} title="First Light" meta="Sep 29 — Oct 06, 2026">
            <StatusBadge status="active" />
          </MediaCard>
        </Demo>
        <Demo title="12 · Profile Card" spec="Border #B8B8B8 · Radius 14px · Shadow 14%">
          <ProfileCard
            avatar={
              <Avatar className="size-12">
                <AvatarFallback>
                  <UserRound size={24} />
                </AvatarFallback>
              </Avatar>
            }
            name="Canvas Maker"
            description="함께 그리는 순간을 수집합니다."
          >
            <span className="font-data">8xQ2…7mKP</span>
          </ProfileCard>
        </Demo>
        <Demo title="13 · Info Card" spec="Background #F5F5F5 · Radius 12px · Value 18px">
          <InfoCard label="참여 비용" value="0.01 SOL" />
          <InfoCard label="총 참여자" value="128" />
        </Demo>
        <Demo
          title="14 · Season List Item"
          spec="MediaListItem · Thumbnail 96px · Radius 12px"
          wide
        >
          <MediaListItem
            media={<CanvasArtwork alternate />}
            title="Color Garden"
            description="Sep 20 — Sep 27, 2026"
            action={<StatusBadge status="ended" />}
          />
        </Demo>
        <Demo title="15 · NFT Holder Row" spec="DataRow · Radius 10px · Padding 22px 28px" wide>
          <DataRow
            leading={
              <Avatar>
                <AvatarFallback>CM</AvatarFallback>
              </Avatar>
            }
            items={[
              { label: 'Holder', value: 'Canvas Maker' },
              { label: 'Wallet', value: <span className="font-data">8xQ2…7mKP</span> },
              { label: 'Owned', value: '3 NFTs' },
            ]}
          />
        </Demo>
      </div>
    </>
  );
}
export function StatusExamples() {
  return (
    <>
      <h3 className="catalog-group-title">STATUS & BADGE</h3>
      <div className="catalog-demo-grid">
        <Demo title="21 · Status Badge — Active" spec="Dot 16px · Text #5D4EE2">
          <StatusBadge status="active" />
        </Demo>
        <Demo title="22 · Status Badge — Ended" spec="Filled pill · #EBEBEB / #4F4F4F">
          <StatusBadge status="ended" />
        </Demo>
      </div>
    </>
  );
}
export function StatsExample() {
  return (
    <Demo title="31 · Active Users / Strokes" spec="StatsCard · Border #171717 · Value Bold" wide>
      <StatsCard
        items={[
          { label: 'Active Users', value: '128' },
          { label: 'Strokes', value: '2,048' },
        ]}
      />
    </Demo>
  );
}
