import { MemoryRouter } from 'react-router';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import UiPage from '../UiPage';

it('renders all 31 reference examples and filters search results', async () => {
  const { container } = render(
    <MemoryRouter>
      <UiPage />
    </MemoryRouter>
  );
  expect(container.querySelectorAll('.catalog-demo').length).toBe(31);
  const search = screen.getByRole('searchbox', { name: '시즌 검색' });
  await userEvent.type(search, 'not-found');
  expect(screen.getByText('검색 결과가 없습니다.')).toBeTruthy();
  await userEvent.clear(search);
  expect(screen.getAllByText('First Light').length).toBeGreaterThan(0);
});

it('opens an accessible modal, closes with Escape, and restores trigger focus', async () => {
  render(
    <MemoryRouter>
      <UiPage />
    </MemoryRouter>
  );
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: '모달 열기' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: '새로운 시즌 만들기' });
  expect(within(dialog).getByRole('button', { name: '닫기' })).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
