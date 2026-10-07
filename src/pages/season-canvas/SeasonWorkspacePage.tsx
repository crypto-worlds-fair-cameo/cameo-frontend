import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CanvasViewport, isCanvasKey, useCanvasMode } from '@/features/canvas-workspace';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { ColorPalette } from '@/shared/ui/color-palette/ColorPalette';
import { Button } from '@/shared/ui/button';
import { useIsMobile } from '@/shared/lib/hooks/use-mobile';
import { useSeasonWorkspace } from './model/useSeasonWorkspace';
import { SeasonWorkspacePanel } from './ui/SeasonWorkspacePanel';
import './ui/season-workspace.css';

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
  const { mode, toggleMode } = useCanvasMode();
  const model = useSeasonWorkspace(id, brush, mode);
  const { realtime } = model;
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
  return (
    <div className="main-canvas-layout season-workspace cameo-light" data-mode={mode}>
      <aside className="canvas-left-sidebar">
        <Link to="/season-canvas" className="season-workspace-back">
          {t('workspace.back')}
        </Link>
        <ColorPalette value={brush} onValueChange={setBrush} defaultOpen={!isMobile} />
        <Button variant="secondary" aria-pressed={mode === 'practice'} onClick={toggleMode}>
          {t(mode === 'practice' ? 'workspace.live' : 'workspace.practice')}
        </Button>
      </aside>
      <CanvasViewport
        workspaceLabel={t('workspace.title')}
        worldWidth={realtime.dimensions.width}
        worldHeight={realtime.dimensions.height}
        brushSettings={brush}
        mode={mode}
        drawingModel={realtime.drawingModel}
      />
      <aside className="canvas-right-area">
        <SeasonWorkspacePanel model={model} mode={mode} />
      </aside>
    </div>
  );
}
