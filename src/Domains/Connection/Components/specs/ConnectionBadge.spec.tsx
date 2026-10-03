import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionBadge } from '../ConnectionBadge';

vi.mock('../../Hooks/useConnectionStatus', () => ({
  useConnectionStatus: () => ({ state: 'connected' }),
}));

describe('ConnectionBadge', () => {
  it('shows the connection label for the current state', () => {
    render(<ConnectionBadge />);
    expect(screen.getByRole('status')).toHaveTextContent('Conectado');
  });
});
