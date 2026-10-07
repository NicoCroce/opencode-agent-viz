import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { THistoryEntry } from '@app/Domains/History/History.entity';
import { HistoryTimeline } from '../HistoryTimeline';

/** Callback del último `IntersectionObserver` construido, para dispararlo a mano. */
let observerCallback: IntersectionObserverCallback | null = null;
const observe = vi.fn();
const disconnect = vi.fn();

class MockIntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe = observe;
  unobserve = vi.fn();
  disconnect = disconnect;
  takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
}

const answer = (
  id: string,
  at: number,
  text: string,
  isComplete = true,
): THistoryEntry => ({ kind: 'answer', id, at, text, isComplete });

const userEntry = (id: string, at: number, text: string): THistoryEntry => ({
  kind: 'user',
  id,
  at,
  text,
  attachments: [],
});

const tool = (id: string, at: number, name: string): THistoryEntry => ({
  kind: 'tool',
  id,
  at,
  entry: {
    id,
    name,
    status: 'completed',
    input: { path: 'a.ts' },
    result: 'ok',
    error: null,
    startedAt: at,
    completedAt: at + 5,
    durationMs: 5,
  },
});

const baseProps = {
  showReasoning: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: () => {},
};

const compaction = (id: string, at: number): THistoryEntry => ({
  kind: 'compaction',
  id,
  at,
  status: 'completed',
  reason: 'auto',
  summary: null,
});

const question = (id: string, at: number): THistoryEntry => ({
  kind: 'question',
  id,
  at,
  formId: id,
  title: '¿Qué hago?',
  fields: [],
  state: 'answered',
  answer: 'choice: a',
  anchorId: 't-q',
  anchored: true,
});

describe('HistoryTimeline', () => {
  beforeEach(() => {
    observerCallback = null;
    observe.mockReset();
    disconnect.mockReset();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the entries in chronological order', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        entries={[
          userEntry('u1', 1, 'Mensaje del usuario'),
          answer('a1', 2, 'Primera respuesta'),
          tool('t1', 3, 'read'),
          answer('a2', 4, 'Segunda respuesta'),
        ]}
      />,
    );

    const first = screen.getByText('Primera respuesta');
    const toolButton = screen.getByRole('button', { name: /read/i });
    const second = screen.getByText('Segunda respuesta');

    expect(
      first.compareDocumentPosition(toolButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      toolButton.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Mensaje del usuario')).toBeInTheDocument();
  });

  it('shows an explicit empty state when there is no activity', () => {
    render(<HistoryTimeline {...baseProps} entries={[]} />);

    expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument();
  });

  it('marks an unconsolidated answer as in progress', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        entries={[answer('a1', 1, 'texto parcial', false)]}
      />,
    );

    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.queryByText('texto parcial')).not.toBeInTheDocument();
  });

  it('renders the injected compaction context for an episode with the session', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        sessionId="ses-7"
        renderCompactionContext={(sessionId) => (
          <span data-testid="compaction-context">{sessionId}</span>
        )}
        entries={[compaction('c1', 1)]}
      />,
    );

    expect(screen.getByTestId('compaction-context')).toHaveTextContent('ses-7');
  });

  it('shows no compaction context when the caller injects no render', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        sessionId="ses-7"
        entries={[compaction('c1', 1)]}
      />,
    );

    expect(screen.queryByTestId('compaction-context')).not.toBeInTheDocument();
  });

  it('renders a question in its chronological position with its answer (FR-033)', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        entries={[answer('a1', 1, 'Respuesta'), question('q1', 2)]}
      />,
    );

    expect(screen.getByText('¿Qué hago?')).toBeInTheDocument();
    expect(screen.getByText('respondida')).toBeInTheDocument();
    expect(screen.getByText('Respuesta: choice: a')).toBeInTheDocument();
  });

  it('fetches the next page when the top sentinel intersects', () => {
    const fetchNextPage = vi.fn();
    render(
      <HistoryTimeline
        {...baseProps}
        hasNextPage
        fetchNextPage={fetchNextPage}
        entries={[answer('a1', 1, 'Respuesta')]}
      />,
    );

    expect(observe).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).not.toHaveBeenCalled();

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not observe the sentinel when there are no more pages', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        hasNextPage={false}
        entries={[answer('a1', 1, 'Respuesta')]}
      />,
    );

    expect(screen.queryByTestId('history-sentinel')).not.toBeInTheDocument();
    expect(observe).not.toHaveBeenCalled();
  });

  it('warns explicitly when the server cannot keep loading activity', () => {
    render(
      <HistoryTimeline
        {...baseProps}
        hasNextPage
        isFetchNextPageError
        entries={[answer('a1', 1, 'Respuesta')]}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/puede faltar/i);
    // Un fallo de página no se presenta como el final de la sesión.
    expect(screen.queryByText('Sin actividad registrada')).not.toBeInTheDocument();
  });
});
