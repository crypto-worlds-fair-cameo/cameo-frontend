import type { StrokePreview } from '../api/canvasProtocol';
import type { CanvasDrawing, CanvasStroke } from '../model/useCanvasDrawing';

/**
 * 도화지 전체를 작게 보여 주는 배율에서는 대부분의 획이 1px보다 가늘어 사라지므로, 위치가 보이도록 최소 굵기로 키워 그린다.
 * 에어브러시의 흩뿌린 점은 작은 크기에서 보이지 않으므로 같은 경로의 둥근 선으로 바꿔 그린다.
 */
export function withMinimumBrush(drawing: CanvasDrawing, minimum: number): CanvasDrawing {
  const widenChunk = (chunk: StrokePreview): StrokePreview =>
    chunk.brush.size >= minimum && chunk.brush.type !== 'airbrush'
      ? chunk
      : {
          ...chunk,
          brush: {
            ...chunk.brush,
            type: chunk.brush.type === 'airbrush' ? 'round' : chunk.brush.type,
            size: Math.max(minimum, chunk.brush.size),
          },
        };
  const widenStroke = (stroke: CanvasStroke): CanvasStroke =>
    stroke.brush.brushSize >= minimum && stroke.brush.brushType !== 'airbrush'
      ? stroke
      : {
          ...stroke,
          brush: {
            ...stroke.brush,
            brushType: stroke.brush.brushType === 'airbrush' ? 'round' : stroke.brush.brushType,
            brushSize: Math.max(minimum, stroke.brush.brushSize),
          },
        };
  return {
    ...drawing,
    serverChunks: drawing.serverChunks?.map(widenChunk),
    liveStrokes: drawing.liveStrokes.map(widenStroke),
    optimisticStrokes: drawing.optimisticStrokes?.map(entry => ({
      ...entry,
      stroke: widenStroke(entry.stroke),
    })),
    activeStroke: drawing.activeStroke && widenStroke(drawing.activeStroke),
    // 연습 획은 공유 도화지가 아니므로 표시하지 않는다.
    practiceStroke: null,
  };
}
