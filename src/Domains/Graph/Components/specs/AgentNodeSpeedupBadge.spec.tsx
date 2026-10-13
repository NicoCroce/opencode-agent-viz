import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TNodeSpeedup } from '../../Graph.entity';
import { AgentNodeSpeedupBadge } from '../AgentNodeSpeedupBadge';

const speedup = (overrides: Partial<TNodeSpeedup> = {}): TNodeSpeedup => ({
  groupId: 'g',
  size: 3,
  serialMs: 250,
  wallMs: 100,
  speedup: 2.5,
  efficiency: 0.83,
  provisional: false,
  ...overrides,
});

describe('AgentNodeSpeedupBadge (T022, FR-009)', () => {
  it('shows ×N with one figure when the group has a speedup', () => {
    render(<AgentNodeSpeedupBadge speedup={speedup()} />);

    const badge = screen.getByTestId('node-speedup');
    expect(badge).toHaveTextContent('×2.5');
    expect(badge).toHaveAttribute('title', 'Aceleración ×2.5');
  });

  it('labels a provisional group in text, not only in color', () => {
    render(<AgentNodeSpeedupBadge speedup={speedup({ provisional: true })} />);

    const badge = screen.getByTestId('node-speedup');
    expect(badge).toHaveTextContent('~×2.5');
    expect(badge).toHaveAttribute('title', 'Aceleración ×2.5 (provisional)');
    expect(badge).toHaveAccessibleName('Aceleración ×2.5 (provisional)');
    expect(badge).toHaveClass('border-dashed');
  });

  it('does not render when the group has no calculable speedup', () => {
    render(<AgentNodeSpeedupBadge speedup={speedup({ speedup: null })} />);

    expect(screen.queryByTestId('node-speedup')).not.toBeInTheDocument();
  });

  it('does not render when the node ran alone', () => {
    render(<AgentNodeSpeedupBadge speedup={null} />);

    expect(screen.queryByTestId('node-speedup')).not.toBeInTheDocument();
  });
});
