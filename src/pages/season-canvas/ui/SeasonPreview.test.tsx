import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonPreview } from './SeasonPreview';
const mocks = vi.hoisted(() => ({
  image: null as string | null,
  snapshot: null as string | null,
  snapshotEnabled: vi.fn(),
}));
vi.mock('@/features/season-nft-claim', () => ({
  useSeasonNftPreview: () => mocks.image,
  useSeasonNftMinted: () => false,
}));
vi.mock('../model/useSeasonSnapshotPreview', () => ({
  useSeasonSnapshotPreview: (_seasonId: string | undefined, enabled: boolean) => {
    mocks.snapshotEnabled(enabled);
    return enabled ? mocks.snapshot : null;
  },
}));
vi.mock('@/features/canvas-workspace', () => ({
  CanvasLivePreview: () => <div data-testid="live-preview" />,
}));
beforeEach(() => {
  mocks.image = null;
  mocks.snapshot = null;
  mocks.snapshotEnabled.mockClear();
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

  it('shows the latest snapshot of a live season and falls back to it after the season ends', () => {
    mocks.snapshot = 'http://localhost:5000/canvas-snapshots/snapshots/seasons/a/b/image.png';
    const { rerender } = render(
      <SeasonPreview seasonId="one" status="active" className="season-card__preview" />
    );
    expect(screen.getByRole('img', { name: '시즌 현재 캔버스' }).getAttribute('src')).toBe(
      mocks.snapshot
    );
    rerender(<SeasonPreview seasonId="one" status="ended" className="season-card__preview" />);
    expect(screen.getByRole('img', { name: '시즌 최종 캔버스' }).getAttribute('src')).toBe(
      mocks.snapshot
    );
  });

  it('does not look up snapshots before a season starts', () => {
    render(<SeasonPreview seasonId="one" status="scheduled" className="season-card__preview" />);
    expect(mocks.snapshotEnabled).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the snapshot under the live canvas as an unlabeled placeholder', () => {
    mocks.snapshot = 'http://localhost:5000/canvas-snapshots/snapshots/seasons/a/b/image.png';
    const { container } = render(
      <SeasonPreview
        seasonId="one"
        status="active"
        variant="detail"
        live={{ requiresSession: false }}
        className="season-detail__preview"
      />
    );
    expect(screen.getByTestId('live-preview')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
