import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import Header from './index';

const items = [
  { path: '/', title: 'Home' },
  { path: '/other', title: 'Other' },
];
function Navigation() {
  const navigate = useNavigate();
  return (
    <>
      <output>{useLocation().pathname}</output>
      <button onClick={() => navigate('/external')}>External navigation</button>
    </>
  );
}
function setup() {
  render(
    <MemoryRouter>
      <Header menuItems={items} />
      <Navigation />
    </MemoryRouter>
  );
  return userEvent.setup();
}

describe('mobile navigation lifecycle', () => {
  it.each(['Home', 'Other'])(
    'closes after selecting %s including the current route',
    async title => {
      const user = setup();
      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      const dialog = screen.getByRole('dialog');
      const link = Array.from(dialog.querySelectorAll('a')).find(a => a.textContent === title)!;
      await user.click(link);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.getByRole('status').textContent).toBe(title === 'Home' ? '/' : '/other');
    }
  );
  it('closes on navigation initiated outside the menu', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    fireEvent.click(screen.getByText('External navigation'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('keeps Escape close and returns focus to its trigger', async () => {
    const user = setup();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
