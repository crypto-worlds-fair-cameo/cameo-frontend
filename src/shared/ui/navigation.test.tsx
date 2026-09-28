import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Tabs } from './tabs';
import { Pagination } from './pagination';

it('moves focus and selected panel with arrow and Home keys', async () => {
  function Example() {
    const [value, setValue] = useState('first');
    return (
      <Tabs
        label="Example"
        value={value}
        onValueChange={setValue}
        items={[
          { value: 'first', label: 'First', content: 'First panel' },
          { value: 'second', label: 'Second', content: 'Second panel' },
        ]}
      />
    );
  }
  render(<Example />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: 'First' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tabpanel').textContent).toBe('Second panel');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Second' }));
  await user.keyboard('{Home}');
  expect(screen.getByRole('tabpanel').textContent).toBe('First panel');
});

it('disables pagination boundaries and selects the requested page', async () => {
  const change = vi.fn();
  render(<Pagination page={1} totalPages={3} onPageChange={change} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '이전 페이지' }));
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '다음 페이지' }));
  expect(change).toHaveBeenCalledWith(2);
});
