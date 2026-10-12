import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initialCanvasConnection,
  initialCanvasSync,
  useCanvasRealtime,
  type CanvasConnectionState,
  type CanvasSyncState,
} from '@/features/canvas-workspace';
import MainCanvasPage from './MainCanvasPage';

type CanvasDrawingModel = ReturnType<typeof useCanvasRealtime>['drawingModel'];

vi.mock('@/features/canvas-workspace', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/canvas-workspace')>()),
  useCanvasRealtime: vi.fn(),
  // 도화지 대신 페이지가 넘긴 그리기 모델로 획 시작만 시도하는 버튼과 도화지 위 표시를 둔다.
  CanvasViewport: ({
    drawingModel,
    children,
  }: {
    drawingModel: CanvasDrawingModel;
    children?: ReactNode;
  }) => (
    <>
      <button type="button" onClick={() => drawingModel.startStroke(1, { x: 5_000, y: 5_000 })}>
        draw
      </button>
      {children}
    </>
  ),
  // 지도는 그림 모델 없이 렌더링되지 않으므로 이 페이지 테스트에서는 비운다.
  CanvasNavigator: () => null,
}));

function mockRealtime(
  userId: string | undefined,
  status: CanvasSyncState['status'] = 'ready',
  connectionStatus: CanvasConnectionState['status'] = initialCanvasConnection.status
) {
  // 엔진은 손님과 이미 그린 계정의 실제 획을 모두 거절한다.
  const startStroke = vi.fn(() => false);
  vi.mocked(useCanvasRealtime).mockReturnValue({
    connection: { ...initialCanvasConnection, status: connectionStatus },
    sync: { ...initialCanvasSync, status, userId },
    retryRecovery: vi.fn(),
    drawingModel: { startStroke } as unknown as CanvasDrawingModel,
    strokeNotice: null,
    onStrokeNoticeOpenChange: vi.fn(),
  } as unknown as ReturnType<typeof useCanvasRealtime>);
  return startStroke;
}

describe('main canvas page', () => {
  beforeEach(() => vi.mocked(useCanvasRealtime).mockReset());

  it('asks a guest to connect a wallet when a real stroke is refused', () => {
    const startStroke = mockRealtime(undefined);
    render(<MainCanvasPage />);
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    expect(startStroke).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog', { name: '획을 남길까요?' })).toBeTruthy();
  });

  it('does not show the wallet notice to a signed-in account', () => {
    mockRealtime('user-1');
    render(<MainCanvasPage />);
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    expect(screen.queryByRole('alertdialog', { name: '획을 남길까요?' })).toBeNull();
  });

  it('shows the loading message once on the paper while the first drawing loads', () => {
    mockRealtime(undefined, 'waiting');
    const { rerender } = render(<MainCanvasPage />);
    expect(screen.getAllByText('공유 그림을 불러오는 중입니다…')).toHaveLength(1);
    expect(document.querySelector('.main-canvas-loading')).not.toBeNull();

    mockRealtime(undefined, 'ready');
    rerender(<MainCanvasPage />);
    expect(document.querySelector('.main-canvas-loading')).toBeNull();

    // 재연결 복구는 이미 보이는 그림을 덮지 않고 오른쪽 안내만 표시한다.
    mockRealtime(undefined, 'recovering');
    rerender(<MainCanvasPage />);
    expect(document.querySelector('.main-canvas-loading')).toBeNull();
    expect(screen.getByText('공유 그림을 불러오는 중입니다…')).toBeTruthy();
  });

  it('hides the loading message while the connection is retrying', () => {
    mockRealtime(undefined, 'waiting', 'reconnecting');
    render(<MainCanvasPage />);
    expect(document.querySelector('.main-canvas-loading')).toBeNull();
  });
});
