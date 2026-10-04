import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import type { CanvasConnectionState } from '../model/canvasConnection';
import { CanvasConnectionStatus } from './CanvasConnectionStatus';

interface CanvasStatsPanelProps {
  connection: CanvasConnectionState;
}

/** 페이지 소켓의 최신 연결 수를 Stats에 표시하고, 연결 복구 안내를 같은 패널에 둔다. */
export function CanvasStatsPanel({ connection }: CanvasStatsPanelProps) {
  const { t } = useTranslation('mainCanvas');
  // 준비 완료 상태에서만 서버 연결 수를 표시하고, 그 외에는 이전 값 대신 미확인 표시를 쓴다.
  // 현재 서버 값은 고유 사용자 수가 아니라 탭·기기를 포함한 활성 연결 수다.
  const activeUsers = connection.status === 'ready' ? connection.connectionCount : null;

  return (
    <Card
      className="canvas-stats-panel"
      data-status={connection.status}
      aria-label={t('stats.title')}
    >
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="canvas-stats-trigger">
            {t('stats.title')}
            <ChevronDown aria-hidden="true" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="canvas-stats-metric" aria-live="polite" aria-atomic="true">
            <dt>
              <span className="canvas-stats-dot" aria-hidden="true" />
              {t('stats.activeUsers')}
            </dt>
            <dd aria-label={activeUsers === null ? t('stats.unavailable') : undefined}>
              {activeUsers ?? '—'}
            </dd>
          </dl>
        </CollapsibleContent>
      </Collapsible>
      {/* 통계가 접혀 있어도 자동 복구 상태와 장애 사유를 계속 표시한다. */}
      <CanvasConnectionStatus connection={connection} />
    </Card>
  );
}
