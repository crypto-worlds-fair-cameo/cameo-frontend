import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it.each(['scheduled', 'active', 'ended', 'cancelled'] as const)(
    'renders the %s lifecycle without coercing it',
    status => {
      render(<StatusBadge status={status}>{status}</StatusBadge>);
      expect(screen.getByText(status).className).toContain(`cameo-status--${status}`);
    }
  );
});
