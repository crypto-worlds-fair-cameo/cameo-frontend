import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeasonEndDialog } from './SeasonEndDialog';

describe('season force end confirmation', () => {
  it('requires the exact season title before submitting', () => {
    const onConfirm = vi.fn();
    render(
      <SeasonEndDialog
        open
        title="Design the UI"
        participantCount={7}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    const input = screen.getByRole('textbox');
    const submit = screen.getByRole('button', { name: '시즌 강제 종료' });
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: 'design the UI' } });
    fireEvent.submit(input.closest('form')!);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Design the UI ' } });
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: 'Design the UI' } });
    expect(submit.hasAttribute('disabled')).toBe(false);
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks submission and dismissal while ending', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const props = { open: true, title: 'A', participantCount: 2, onOpenChange, onConfirm };
    const { rerender } = render(<SeasonEndDialog {...props} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A' } });
    rerender(<SeasonEndDialog {...props} loading />);
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: '취소' }).hasAttribute('disabled')).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('clears a previous confirmation when reopened and honors lost permission', () => {
    const props = {
      open: true,
      title: 'A',
      participantCount: 2,
      onOpenChange: vi.fn(),
      onConfirm: vi.fn(),
    };
    const { rerender } = render(<SeasonEndDialog {...props} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A' } });
    rerender(<SeasonEndDialog {...props} canConfirm={false} />);
    expect(screen.getByRole('button', { name: '시즌 강제 종료' }).hasAttribute('disabled')).toBe(
      true
    );
    rerender(<SeasonEndDialog {...props} open={false} />);
    rerender(<SeasonEndDialog {...props} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });
});
