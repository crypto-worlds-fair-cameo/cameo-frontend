import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { GlassPanel } from '@/shared/ui/glass-panel';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/shared/ui/dialog';
import { useOverlayExamples } from '../model/useCatalogExamples';
import { Demo } from './CatalogSection';

export function OverlayExamples() {
  const state = useOverlayExamples();
  return (
    <>
      <h3 className="catalog-group-title">GLASS & MODAL</h3>
      <div className="catalog-demo-grid">
        <Demo title="16 · Modal (공통)" spec="Background #FFFFFF · Radius 24px · Shadow 15%">
          <Button onClick={event => state.openDialog('modal', event.currentTarget)}>
            모달 열기
          </Button>
          <p className="catalog-demo-muted">Escape로 닫고 원래 버튼으로 돌아갑니다.</p>
        </Demo>
        <Demo title="17 · Glass Panel" spec="White 80% · Blur 2px · Radius 12px" canvas>
          <GlassPanel>
            <strong>Canvas tools</strong>
            <p>캔버스 위에 놓이는 반투명 패널</p>
          </GlassPanel>
        </Demo>
        <Demo
          title="18 · Glass Confirm Dialog"
          spec="White 80% · Border #B8B8B8 · Radius 24px"
          canvas
        >
          <ConfirmDialog
            open={state.dialog === 'glass'}
            onOpenChange={open => state.setDialog(open ? 'glass' : null)}
            title="변경 사항을 저장할까요?"
            description="실제 저장 없이 확인 동작만 체험합니다."
            onConfirm={state.confirm}
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            glass
            contentClassName="cameo-light"
            trigger={<Button variant="glass">확인 다이얼로그 열기</Button>}
          />
        </Demo>
        <Demo title="19 · Modal Close Button" spec="48 × 48px · 모달 우측 상단">
          <p className="catalog-demo-muted">모달을 열어 48px 닫기 버튼을 확인하세요.</p>
          <Button
            variant="secondary"
            onClick={event => state.openDialog('modal', event.currentTarget)}
          >
            닫기 동작 확인
          </Button>
        </Demo>
        <Demo title="20 · Modal Overlay" spec="rgba(0,0,0,0.5) · 모달 뒤 배경 차단">
          <div className="catalog-overlay-preview">
            <span>Canvas</span>
            <div />
            <span>50% black</span>
          </div>
        </Demo>
      </div>
      <p className="catalog-feedback" role="status">
        {state.message}
      </p>
      <Dialog
        open={state.dialog === 'modal'}
        onOpenChange={open => {
          if (!open) state.closeDialog();
        }}
      >
        <DialogContent
          className="cameo-light"
          onCloseAutoFocus={event => {
            event.preventDefault();
            state.trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>새로운 시즌 만들기</DialogTitle>
            <DialogDescription>
              공통 UI 동작 예시입니다. 실제 저장이나 블록체인 거래는 발생하지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <p>키보드 Tab으로 버튼을 이동하고 Escape 또는 닫기 버튼으로 돌아갈 수 있습니다.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={state.closeDialog}>
              Cancel
            </Button>
            <Button onClick={state.confirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
