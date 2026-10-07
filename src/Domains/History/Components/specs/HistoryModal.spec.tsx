import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { THistoryEntry, TLineageNav } from '@app/Domains/History/History.entity';
import type { HistoryPagination } from '@app/Domains/History/Hooks/useHistoryPagination';
import { HistoryModal } from '../HistoryModal';

const { useHistoryPagination } = vi.hoisted(() => ({
  useHistoryPagination: vi.fn(),
}));

vi.mock('../../Hooks/useHistoryPagination', () => ({ useHistoryPagination }));

const pagination = (
  overrides: Partial<HistoryPagination> = {},
): HistoryPagination => ({
  entries: [],
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: vi.fn(),
  ...overrides,
});

/** Nodo con todos los datos ausentes para ejercitar el "no disponible" (FR-038). */
const makeNode = (overrides: Partial<TGraphNode['data']> = {}): TGraphNode => ({
  id: 'ses-1',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: 'ses-1',
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '',
    model: null,
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: null,
      startedAt: null,
      endedAt: null,
      cost: null,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
    ...overrides,
  },
});

const lineage: TLineageNav = { parentId: null, childrenIds: [] };

const answer = (id: string, at: number, text: string): THistoryEntry => ({
  kind: 'answer',
  id,
  at,
  text,
  isComplete: true,
});

const renderModal = (
  node: TGraphNode = makeNode(),
  overrides: {
    onNavigate?: () => void;
    onClose?: () => void;
    onToggleReasoning?: () => void;
    showReasoning?: boolean;
  } = {},
) =>
  render(
    <HistoryModal
      node={node}
      lineage={lineage}
      showReasoning={overrides.showReasoning ?? false}
      onToggleReasoning={overrides.onToggleReasoning ?? (() => {})}
      onNavigate={overrides.onNavigate ?? (() => {})}
      onClose={overrides.onClose ?? (() => {})}
    />,
  );

describe('HistoryModal', () => {
  beforeEach(() => {
    useHistoryPagination.mockReset();
    useHistoryPagination.mockReturnValue(pagination());
  });

  it('renders the header with "no disponible" for missing data', () => {
    renderModal();

    expect(useHistoryPagination).toHaveBeenCalledWith('ses-1', []);
    expect(screen.getAllByText('develop').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByLabelText('no disponible').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('forwards the questions to the pagination (FR-033)', () => {
    const questions = [
      {
        id: 'q1',
        title: '¿Qué hago?',
        fields: [],
        state: 'answered' as const,
        answer: 'choice: a',
      },
    ];

    render(
      <HistoryModal
        node={makeNode()}
        lineage={lineage}
        showReasoning={false}
        onToggleReasoning={() => {}}
        onNavigate={() => {}}
        onClose={() => {}}
        questions={questions}
      />,
    );

    expect(useHistoryPagination).toHaveBeenCalledWith('ses-1', questions);
  });

  it('renders the injected compaction context (FR-035)', () => {
    useHistoryPagination.mockReturnValue(
      pagination({
        entries: [
          {
            kind: 'compaction',
            id: 'c1',
            at: 1,
            status: 'completed',
            reason: 'auto',
            summary: null,
          },
        ],
      }),
    );

    render(
      <HistoryModal
        node={makeNode()}
        lineage={lineage}
        showReasoning={false}
        onToggleReasoning={() => {}}
        onNavigate={() => {}}
        onClose={() => {}}
        renderCompactionContext={() => (
          <span data-testid="compaction-context">contexto</span>
        )}
      />,
    );

    expect(screen.getByTestId('compaction-context')).toBeInTheDocument();
  });

  it('shows the empty state when the session has no activity', () => {
    renderModal();

    expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument();
  });

  it('shows the error state when the history fails to load', () => {
    useHistoryPagination.mockReturnValue(pagination({ isError: true }));

    renderModal();

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(
      screen.getByText('No se pudo cargar el histórico de la sesión.'),
    ).toBeInTheDocument();
  });

  it('renders the timeline entries for the loaded data', () => {
    useHistoryPagination.mockReturnValue(
      pagination({ entries: [answer('a1', 1, 'Respuesta del agente')] }),
    );

    renderModal();

    expect(screen.getByText('Respuesta del agente')).toBeInTheDocument();
  });

  it('closes the overlay through onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderModal(makeNode(), { onClose });

    await user.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes the reasoning toggle state through aria-pressed', () => {
    renderModal(makeNode(), { showReasoning: true });

    expect(
      screen.getByRole('button', { name: /razonamiento/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
