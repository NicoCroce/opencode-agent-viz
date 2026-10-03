import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionInfo } from '@opencode/client';
import { SessionCard } from '../SessionCard';

const session: SessionInfo = {
  id: 'ses_1',
  projectID: 'proj',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 2 },
  location: { directory: '/repo' },
  title: 'Root session',
};

describe('SessionCard', () => {
  it('renders the agent, title and status dot', () => {
    render(
      <SessionCard
        item={{ session, agentName: 'develop' }}
        status={{ type: 'busy' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('Root session')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'En curso' })).toBeInTheDocument();
  });

  it('calls onSelect with the session id', () => {
    const onSelect = vi.fn();
    render(
      <SessionCard
        item={{ session, agentName: null }}
        selected
        onSelect={onSelect}
      />,
    );
    screen.getByRole('button').click();
    expect(onSelect).toHaveBeenCalledWith('ses_1');
  });
});
