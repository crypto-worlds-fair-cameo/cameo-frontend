import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./providers/AppProviders', () => ({
    AppProviders: () => {
        throw new Error('provider secret');
    },
}));

it('contains provider failures with the outer app boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    expect(screen.getByRole('heading', { name: '앱을 표시하지 못했습니다.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '홈으로 이동' })).toBeTruthy();
    expect(screen.queryByText('provider secret')).toBeNull();
});
