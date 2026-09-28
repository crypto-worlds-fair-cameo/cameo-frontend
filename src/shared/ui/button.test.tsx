import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Button } from './button';

it('prevents repeated activation while loading and preserves its accessible label', async () => {
  const onClick = vi.fn();
  render(
    <Button loading onClick={onClick}>
      Sign & Mint
    </Button>
  );
  const button = screen.getByRole('button', { name: 'Sign & Mint' });
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
  expect(button.getAttribute('aria-busy')).toBe('true');
});

it('does not submit a form unless explicitly requested', async () => {
  const submit = vi.fn(event => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <Button>Cancel</Button>
    </form>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(submit).not.toHaveBeenCalled();
});

it('blocks a slotted link and its own handler while loading', async () => {
  const click = vi.fn();
  render(
    <Button asChild loading>
      <a href="#destination" onClick={click}>
        연결
      </a>
    </Button>
  );
  await userEvent.click(screen.getByRole('link', { name: '연결' }));
  expect(click).not.toHaveBeenCalled();
});
