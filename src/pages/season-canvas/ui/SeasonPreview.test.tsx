import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonPreview } from './SeasonPreview';
const mocks = vi.hoisted(() => ({ image: null as string | null }));
vi.mock('@/features/season-nft-claim', () => ({ useSeasonNftPreview: () => mocks.image }));
beforeEach(() => {
  mocks.image = null;
});
describe('SeasonPreview', () => {
  it('uses the final image and recovers the placeholder on load failure without hiding status', () => {
    mocks.image = 'https://arweave.net/' + 'a'.repeat(43);
    const { rerender } = render(
      <SeasonPreview seasonId="one" status="ended" className="season-card__preview" />
    );
    const image = screen.getByRole('img');
    expect(image.getAttribute('src')).toBe(mocks.image);
    fireEvent.error(image);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('종료')).toBeTruthy();
    mocks.image = 'https://arweave.net/' + 'b'.repeat(43);
    rerender(<SeasonPreview seasonId="two" status="ended" className="season-card__preview" />);
    expect(screen.getByRole('img').getAttribute('src')).toBe(mocks.image);
  });
});
