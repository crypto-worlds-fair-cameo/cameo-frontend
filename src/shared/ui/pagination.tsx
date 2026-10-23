import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ui.css';

export function Pagination({
  page,
  totalPages,
  onPageChange,
  label = 'Pagination',
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.min(total, Math.max(1, Math.floor(page)));
  const pages = [...new Set([1, current - 1, current, current + 1, total])]
    .filter(n => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  return (
    <nav className="cameo-pagination" aria-label={label}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={current === 1}
        onClick={() => onPageChange(current - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      {pages.map((n, i) => (
        <span key={n}>
          {i > 0 && n - pages[i - 1] > 1 && (
            <span className="cameo-pagination-gap" aria-hidden="true">
              …
            </span>
          )}
          <button
            type="button"
            aria-label={`Page ${n}`}
            aria-current={n === current ? 'page' : undefined}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={current === total}
        onClick={() => onPageChange(current + 1)}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
