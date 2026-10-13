import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  CanvasNavigator,
  CanvasViewport,
  isCanvasKey,
  useCanvasMode,
  useCanvasZoom,
} from '@/features/canvas-workspace';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { ColorPalette } from '@/shared/ui/color-palette/ColorPalette';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { useIsMobile } from '@/shared/lib/hooks/use-mobile';
import { useState } from 'react';
import { useSeasonWorkspace } from './model/useSeasonWorkspace';
import { SeasonWorkspacePanel } from './ui/SeasonWorkspacePanel';
import './ui/season-workspace.css';

/** 서버가 사용 획 수를 보내지 않을 때만 쓴다. 스냅샷에 굽힌 과거 획은 여기 없어 적게 셀 수 있다. */
function countMyStrokes(
  previews: { userId: string; clientStrokeId: string }[],
  optimistic: { stroke: { clientStrokeId?: string } }[],
  userId: string | undefined
) {
  const ids = new Set<string>();
  if (userId) {
    for (const preview of previews) {
      if (preview.userId === userId) ids.add(preview.clientStrokeId);
    }
  }
  for (const item of optimistic) {
    if (item.stroke.clientStrokeId) ids.add(item.stroke.clientStrokeId);
  }
  return ids.size;
}

/** UUID를 검증한 시즌만 작업 공간을 만들고, 잘못된 주소는 소켓을 열지 않는다. */
export default function SeasonWorkspacePage() {
  const { seasonId } = useParams();
  const { t } = useTranslation('seasonCanvas');
  if (!seasonId || !isCanvasKey(`season:${seasonId}`))
    return (
      <div className="season-workspace-error">
        <h1>{t('workspace.notFound')}</h1>
        <Link to="/season-canvas">{t('workspace.back')}</Link>
      </div>
    );
  return <SeasonWorkspace key={seasonId} id={seasonId} />;
}

function SeasonWorkspace({ id }: { id: string }) {
  const { t } = useTranslation('seasonCanvas');
  const isMobile = useIsMobile();
  const [brush, setBrush] = useState(defaultBrushSettings);
  const { mode } = useCanvasMode();
  const model = useSeasonWorkspace(id, brush, mode);
  const { realtime } = model;
  const zoom = useCanvasZoom(realtime.dimensions.width, realtime.dimensions.height);
  const session = model.scope.session;
  const limit = model.season?.strokeLimitPerUser ?? model.ready?.season.strokeLimitPerUser ?? null;
  const counted =
    realtime.sync.strokesUsedCount ??
    countMyStrokes(realtime.sync.previews, realtime.sync.optimisticStrokes, realtime.sync.userId);
  const used =
    limit === null ? counted : Math.min(limit, realtime.sync.strokeUsed ? limit : counted);
  const zoomPercent = Math.round(zoom.zoom * 100);
  const canvasSize =
    realtime.dimensions.width === realtime.dimensions.height
      ? String(realtime.dimensions.width)
      : `${realtime.dimensions.width}×${realtime.dimensions.height}`;
  const displayName =
    session?.user.displayName?.trim() ||
    (session?.activeWallet.address
      ? `${session.activeWallet.address.slice(0, 4)}…${session.activeWallet.address.slice(-4)}`
      : '');
  // HTTP의 404와 terminal 접근 거절은 이전 그림을 현재 접근 가능 정보처럼 표시하지 않는다.
  const unavailable =
    model.canvasUnavailable ||
    realtime.connection.notice === 'canvas_unavailable' ||
    (model.query.isError && (model.query.error as { statusCode?: number }).statusCode === 404);
  if (unavailable)
    return (
      <div className="season-workspace-error">
        <h1>{t('workspace.notFound')}</h1>
        <Link to="/season-canvas">{t('workspace.back')}</Link>
      </div>
    );
  if (model.walletRequired)
    return (
      <div className="season-workspace-error">
        <h1>{t('workspace.walletRequired')}</h1>
        <p>{t('join.walletHint')}</p>
        <Link to="/season-canvas">{t('workspace.back')}</Link>
      </div>
    );
  return (
    <div
      className="main-canvas-layout season-workspace cameo-light"
      data-mode={mode}
      data-navigating={zoom.navigating || undefined}
    >
      <aside className="canvas-left-sidebar">
        <Link to="/season-canvas" className="season-workspace-back">
          <ChevronLeft aria-hidden="true" />
          {t('workspace.leave')}
        </Link>
        <ColorPalette value={brush} onValueChange={setBrush} defaultOpen={!isMobile} />
        {!isMobile && (
          <CanvasNavigator
            zoom={zoom}
            drawingModel={realtime.drawingModel}
            caption={t('workspace.mapZoom', { percent: zoomPercent, size: canvasSize })}
          />
        )}
      </aside>
      <div className="season-room-stage">
        {session && displayName && (
          <div className="season-room-user">
            <Avatar>
              <AvatarImage src={session.user.avatarUrl || undefined} alt="" />
              <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span>{displayName}</span>
          </div>
        )}
        <CanvasViewport
          workspaceLabel={t('workspace.title')}
          worldWidth={realtime.dimensions.width}
          worldHeight={realtime.dimensions.height}
          brushSettings={brush}
          mode={mode}
          drawingModel={realtime.drawingModel}
          zoom={isMobile ? undefined : zoom}
        />
        <p className="season-room-strokes">
          <span>
            {limit === null
              ? t('workspace.myStrokesOpen', { used })
              : t('workspace.myStrokes', { used, limit })}
          </span>
          {limit !== null && (
            <span className="season-room-strokes-track" aria-hidden="true">
              <span style={{ width: `${limit === 0 ? 0 : (used / limit) * 100}%` }} />
            </span>
          )}
        </p>
      </div>
      <aside className="canvas-right-area">
        <SeasonWorkspacePanel model={model} mode={mode} />
      </aside>
    </div>
  );
}
