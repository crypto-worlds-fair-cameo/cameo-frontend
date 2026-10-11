import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initialCanvasConnection,
  initialCanvasSync,
  useCanvasRealtime,
} from '@/features/canvas-workspace';
import MainCanvasPage from './MainCanvasPage';

type CanvasDrawingModel = ReturnType<typeof useCanvasRealtime>['drawingModel'];

vi.mock('@/features/canvas-workspace', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/canvas-workspace')>()),
  useCanvasRealtime: vi.fn(),
  // 도화지 대신 페이지가 넘긴 그리기 모델로 획 시작만 시도하는 버튼을 둔다.
  CanvasViewport: ({ drawingModel }: { drawingModel: CanvasDrawingModel }) => (
    <button type="button" onClick={() => drawingModel.startStroke(1, { x: 5_000, y: 5_000 })}>
      draw
    </button>
  ),
}));

function mockRealtime(userId: string | undefined) {
  // 엔진은 손님과 이미 그린 계정의 실제 획을 모두 거절한다.
  const startStroke = vi.fn(() => false);
  vi.mocked(useCanvasRealtime).mockReturnValue({
    connection: initialCanvasConnection,
    sync: { ...initialCanvasSync, status: 'ready', userId },
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
});
