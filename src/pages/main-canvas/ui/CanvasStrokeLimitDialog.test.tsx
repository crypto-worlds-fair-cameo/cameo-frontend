import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CanvasStrokeLimitDialog } from './CanvasStrokeLimitDialog';

describe('canvas stroke limit dialog', () => {
  it('announces lifetime consumption with only a dismissal action after successful completion', () => {
    render(<CanvasStrokeLimitDialog open completed onOpenChange={() => {}} />);
    const dialog = screen.getByRole('alertdialog', { name: '한 획을 소진했습니다' });
    expect(dialog.textContent).toContain('평생 한 번뿐인 획을 소진했습니다');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '다시 그리기' })).toBeNull();
  });
  it('labels the modal alert and dismisses it with confirmation', () => {
    function Notice() {
      const [open, setOpen] = useState(true);
      return <CanvasStrokeLimitDialog open={open} onOpenChange={setOpen} />;
    }
    render(<Notice />);
    const dialog = screen.getByRole('alertdialog', { name: '획 사용 완료' });
    expect(dialog.textContent).toContain('이미 한 획을 소진했습니다');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
