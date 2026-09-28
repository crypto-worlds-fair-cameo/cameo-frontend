import { ToggleGroup } from '@/shared/ui/toggle-group';
import { ZoomControls } from '@/shared/ui/zoom-controls';
import { PreviewBox } from '@/shared/ui/preview-box';
import { useCanvasExamples } from '../model/useCatalogExamples';
import { Demo } from './CatalogSection';

export function CanvasExamples() {
  const state = useCanvasExamples();
  return (
    <>
      <h3 className="catalog-group-title">CANVAS TOOLS</h3>
      <div className="catalog-demo-grid">
        <Demo title="23 · Toggle Button Group" spec="Selected #171717 · Radius 4px · Font 10px">
          <ToggleGroup
            label="캔버스 도구"
            value={state.tool}
            onValueChange={state.setTool}
            items={[
              { value: 'brush', label: 'Brush' },
              { value: 'eraser', label: 'Eraser' },
              { value: 'hand', label: 'Hand' },
            ]}
          />
          <p className="catalog-demo-muted">선택한 도구: {state.tool}</p>
        </Demo>
        <Demo title="24 · Zoom Controls" spec="Button 29 × 24px · Radius 8px">
          <ZoomControls value={state.zoom} onValueChange={state.setZoom} />
        </Demo>
        <Demo title="25 · Preview Box" spec="143 × 80px · Border #D6D6D6 · Radius 8px">
          <PreviewBox aria-label={`캔버스 미리보기 ${state.zoom}%`}>
            <div
              className="catalog-preview-art"
              style={{ transform: `scale(${state.zoom / 100})` }}
            />
          </PreviewBox>
          <p className="catalog-demo-muted">확대 컨트롤과 연결된 미리보기</p>
        </Demo>
      </div>
    </>
  );
}
