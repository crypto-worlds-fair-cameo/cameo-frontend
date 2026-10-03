import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/app/i18n/i18n';
import { ColorPalette } from './ColorPalette';
import type { BrushSettings } from './model/brushSettings';

const initial: BrushSettings = {
  color: '#ED4242',
  brushType: 'round',
  brushSize: 12,
  opacity: 100,
};

function Harness() {
  const [value, setValue] = useState(initial);
  return <ColorPalette value={value} onValueChange={setValue} />;
}

describe('color palette settings', () => {
  it('synchronizes a preset with HEX, RGB and the preview', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '색상 #2E3BD4' }));
    expect((screen.getByRole('textbox', { name: 'HEX 색상' }) as HTMLInputElement).value).toBe(
      '#2E3BD4'
    );
    expect((screen.getByRole('slider', { name: 'R' }) as HTMLInputElement).value).toBe('46');
    expect((screen.getByRole('slider', { name: 'G' }) as HTMLInputElement).value).toBe('59');
    expect((screen.getByRole('slider', { name: 'B' }) as HTMLInputElement).value).toBe('212');
    expect(
      screen
        .getByRole('img', { name: /브러시 미리보기/ })
        .querySelector('path')
        ?.getAttribute('stroke')
    ).toBe('#2E3BD4');
  });

  it('commits valid HEX on Enter and preserves the other settings', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'HEX 색상' });
    await user.clear(input);
    await user.type(input, '#00ff80{Enter}');
    expect(document.activeElement).toBe(input);
    expect((screen.getByRole('textbox', { name: 'HEX 색상' }) as HTMLInputElement).value).toBe(
      '#00FF80'
    );
    expect((screen.getByRole('slider', { name: 'G' }) as HTMLInputElement).value).toBe('255');
    expect((screen.getByRole('slider', { name: '브러시 크기' }) as HTMLInputElement).value).toBe(
      '12'
    );
  });

  it('keeps the last valid color for invalid HEX and cancels the draft with Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'HEX 색상' });
    await user.clear(input);
    await user.type(input, '#xyz{Enter}');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert')).toBeDefined();
    expect((screen.getByRole('slider', { name: 'R' }) as HTMLInputElement).value).toBe('237');
    await user.click(input);
    await user.keyboard('{Escape}');
    expect((input as HTMLInputElement).value).toBe('#ED4242');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('updates one RGB channel without changing the others', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('slider', { name: 'R' }), { target: { value: '0' } });
    expect((screen.getByRole('textbox', { name: 'HEX 색상' }) as HTMLInputElement).value).toBe(
      '#004242'
    );
    expect((screen.getByRole('slider', { name: 'G' }) as HTMLInputElement).value).toBe('66');
    expect((screen.getByRole('slider', { name: 'B' }) as HTMLInputElement).value).toBe('66');
  });

  it('commits valid HEX when focus moves to another control', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'HEX 색상' });
    await user.clear(input);
    await user.type(input, '#ffffff');
    await user.click(screen.getByRole('button', { name: '평붓' }));
    expect((input as HTMLInputElement).value).toBe('#FFFFFF');
    expect((screen.getByRole('slider', { name: 'R' }) as HTMLInputElement).value).toBe('255');
    expect(screen.getByRole('button', { name: '평붓' }).getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['#000000', '#ED4242'])(
    'replaces an invalid HEX draft when preset %s is selected',
    async color => {
      const user = userEvent.setup();
      render(<Harness />);
      const input = screen.getByRole('textbox', { name: 'HEX 색상' });
      await user.clear(input);
      await user.type(input, '#bad{Enter}');
      await user.click(screen.getByRole('button', { name: `색상 ${color}` }));
      const updatedInput = screen.getByRole('textbox', { name: 'HEX 색상' });
      expect((updatedInput as HTMLInputElement).value).toBe(color);
      expect(updatedInput.getAttribute('aria-invalid')).toBe('false');
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );

  it('reflects brush shape, size and zero opacity in the preview', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '평붓' }));
    expect(screen.getByRole('button', { name: '평붓' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('slider', { name: '브러시 크기' }), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByRole('slider', { name: '불투명도' }), { target: { value: '0' } });
    const path = screen.getByRole('img', { name: /브러시 미리보기/ }).querySelector('path');
    expect(path?.getAttribute('stroke-linecap')).toBe('square');
    expect(path?.getAttribute('stroke-width')).toBe('50');
    expect(path?.getAttribute('opacity')).toBe('0');
    await user.click(screen.getByRole('button', { name: '에어브러시' }));
    expect(
      screen
        .getByRole('img', { name: /브러시 미리보기/ })
        .querySelector('path')
        ?.getAttribute('filter')
    ).toContain('url(#');
  });

  it('preserves settings when the panel and custom section are collapsed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.change(screen.getByRole('slider', { name: '불투명도' }), { target: { value: '35' } });
    await user.click(screen.getByRole('button', { name: '직접 설정' }));
    expect(screen.queryByRole('textbox', { name: 'HEX 색상' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '컬러 팔레트' }));
    expect(screen.queryByRole('slider', { name: '불투명도' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '컬러 팔레트' }));
    expect((screen.getByRole('slider', { name: '불투명도' }) as HTMLInputElement).value).toBe('35');
  });

  it('renders English control names when the language changes', async () => {
    await i18n.changeLanguage('en');
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Color Palette' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'HEX color' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Brush Size' })).toBeDefined();
  });
});
