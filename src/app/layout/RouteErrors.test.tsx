import { lazy, Suspense, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from './Layout';

function BrokenPage(): never {
  throw new Error('private render detail');
}
function NavigateAway() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/ok')}>Navigate away</button>;
}

describe('page error isolation', () => {
  beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
  it('keeps the app shell visible and recovers on a new location', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <NavigateAway />
        <Routes>
          <Route element={<Layout showSidebar={false} />}>
            <Route path="/broken" element={<BrokenPage />} />
            <Route path="/ok" element={<h1>Recovered page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('private render detail')).toBeNull();
    expect(screen.getByRole('banner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Navigate away' }));
    expect(await screen.findByRole('heading', { name: 'Recovered page' })).toBeTruthy();
  });
  it('provides recovery for a rejected lazy module', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const FailedModule = lazy(() => Promise.reject(new Error('private chunk URL')));
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout showSidebar={false} />}>
            <Route
              path="/"
              element={
                <Suspense fallback={<p>Pending</p>}>
                  <FailedModule />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeTruthy();
    expect(screen.queryByText('private chunk URL')).toBeNull();
  });
});

function StatefulPage() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => setCount(count + 1)}>Count {count}</button>
      <button onClick={() => navigate('?view=other')}>Change query</button>
    </>
  );
}
it('does not remount a healthy page merely to reset its error boundary', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Layout showSidebar={false} />}>
          <Route path="/" element={<StatefulPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
  fireEvent.click(screen.getByRole('button', { name: 'Change query' }));
  expect(screen.getByRole('button', { name: 'Count 1' })).toBeTruthy();
});
