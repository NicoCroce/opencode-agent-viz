import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionInfo } from '@opencode/client';
import { SessionList } from '../SessionList';
import type { TSessionGroup } from '../../Hooks/useRootSessions';

const session = (id: string, directory: string): SessionInfo => ({
  id,
  projectID: 'proj',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 2 },
  location: { directory },
  title: `session ${id}`,
});

const groups: TSessionGroup[] = [
  {
    directory: '/Users/dev/proj-a',
    items: [{ session: session('a', '/Users/dev/proj-a'), agentName: 'develop' }],
  },
  {
    directory: '/Users/dev/proj-b',
    items: [{ session: session('b', '/Users/dev/proj-b'), agentName: 'build' }],
  },
];

describe('SessionList', () => {
  it('segments sessions by folder name', () => {
    render(
      <SessionList groups={groups} selectedId={null} onSelect={() => undefined} />,
    );
    expect(screen.getByText('proj-a')).toBeInTheDocument();
    expect(screen.getByText('proj-b')).toBeInTheDocument();
    expect(screen.getByText('session a')).toBeInTheDocument();
    expect(screen.getByText('session b')).toBeInTheDocument();
  });
});
