import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CanvasWalletRequiredDialog } from './CanvasWalletRequiredDialog';

describe('canvas wallet required dialog', () => {
  it('points a guest to the header wallet button and closes on confirm', () => {
    function Notice() {
      const [open, setOpen] = useState(true);
      return <CanvasWalletRequiredDialog open={open} onOpenChange={setOpen} />;
    }
    render(<Notice />);
    const dialog = screen.getByRole('alertdialog', { name: '획을 남길까요?' });
    expect(dialog.textContent).toContain('오른쪽 위의 지갑 연결 버튼');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
