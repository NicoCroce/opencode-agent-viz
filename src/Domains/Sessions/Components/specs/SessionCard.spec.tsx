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

const START = new Date(2024, 0, 15, 9, 5).getTime();
const END = new Date(2024, 0, 15, 17, 42).getTime();

const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

// Los extremos del rango son requeridos por el SDK; se fuerzan a `null` para
// cubrir la rama defensiva `"no disponible"` del helper (FR-016).
const sessionWithTime = (
  created: number | null,
  updated: number | null,
): SessionInfo =>
  ({ ...session, time: { created, updated } }) as unknown as SessionInfo;

const isBefore = (first: HTMLElement, second: HTMLElement): boolean =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

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

  it('renders the title as the main line above the agent as the secondary line', () => {
    render(
      <SessionCard
        item={{ session, agentName: 'develop' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    const title = screen.getByText('Root session');
    const agent = screen.getByText('develop');
    expect(isBefore(title, agent)).toBe(true);
  });

  it('shows "agente no disponible" when the agent name is null', () => {
    render(
      <SessionCard
        item={{ session, agentName: null }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('agente no disponible')).toBeInTheDocument();
    expect(screen.queryByText('agent')).not.toBeInTheDocument();
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

  it('renders the created–updated range when the session is idle', () => {
    render(
      <SessionCard
        item={{ session: sessionWithTime(START, END), agentName: 'develop' }}
        status={{ type: 'idle' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(`${clock(START)} – ${clock(END)}`),
    ).toBeInTheDocument();
  });

  it('renders the updated end when no status is provided', () => {
    render(
      <SessionCard
        item={{ session: sessionWithTime(START, END), agentName: 'develop' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(`${clock(START)} – ${clock(END)}`),
    ).toBeInTheDocument();
  });

  it('renders "en curso" while the session is busy', () => {
    render(
      <SessionCard
        item={{ session: sessionWithTime(START, END), agentName: 'develop' }}
        status={{ type: 'busy' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(`${clock(START)} – en curso`),
    ).toBeInTheDocument();
  });

  it('renders "en curso" while the session is retrying', () => {
    render(
      <SessionCard
        item={{ session: sessionWithTime(START, END), agentName: 'develop' }}
        status={{
          type: 'retry',
          attempt: 1,
          message: 'rate limited',
          next: 0,
        }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(`${clock(START)} – en curso`),
    ).toBeInTheDocument();
  });

  it('renders "no disponible" when the update time is missing', () => {
    render(
      <SessionCard
        item={{ session: sessionWithTime(START, null), agentName: 'develop' }}
        status={{ type: 'idle' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(`${clock(START)} – no disponible`),
    ).toBeInTheDocument();
  });

  it('renders "no disponible" when the creation time is missing', () => {
    render(
      <SessionCard
        item={{ session: sessionWithTime(null, END), agentName: 'develop' }}
        status={{ type: 'idle' }}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(`no disponible – ${clock(END)}`),
    ).toBeInTheDocument();
  });
});
