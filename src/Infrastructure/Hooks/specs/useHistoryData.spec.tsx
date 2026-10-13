import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SessionMessageInfo } from '@opencode/client';
import type { TGraphModel, TGraphNode, TGraphNodeData } from '@app/Domains/Graph';
import { formDetail, formInfo } from '../../lib/specs/fixtures';
import { EMPTY_LINEAGE } from '../../WorkspacePage.constants';
import { useHistoryData } from '../useHistoryData';

const { listSessionForms, getSessionForm, getSessionContext } = vi.hoisted(
  () => ({
    listSessionForms: vi.fn(),
    getSessionForm: vi.fn(),
    getSessionContext: vi.fn(),
  }),
);

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: { listSessionForms, getSessionForm, getSessionContext },
}));

/**
 * `useHistoryData` es la composición que `HistoryOverlay` recibe hoy: la vista
 * del overlay (`useHistoryOverlay`) más las preguntas (FR-033) y el contexto de
 * compactación (FR-035) de la sesión **del nodo abierto**. El `sessionId` se
 * deriva del nodo, no de la página: sin nodo (o con un `targetId` inexistente)
 * ninguna consulta se dispara.
 */

const ROOT = 'root';
const CHILD = 'child';
const GRANDCHILD = 'grandchild';
const GHOST = 'ghost';

const ROOT_SESSION = 'ses-root';
const CHILD_SESSION = 'ses-child';
const OTHER_SESSION = 'ses-other';

const nodeData = (sessionId: string): TGraphNodeData => ({
  sessionId,
  title: null,
  createdAt: null,
  updatedAt: null,
  agentName: 'build',
  directory: '/repo/opencode-agent-viz',
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
  isRoot: false,
  currentTool: null,
  parallel: null,
});

const graphNode = (id: string, sessionId: string): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: nodeData(sessionId),
});

/** Árbol root → child → grandchild: el nodo del overlay es `child`. */
const graph: TGraphModel = {
  nodes: [
    graphNode(ROOT, ROOT_SESSION),
    graphNode(CHILD, CHILD_SESSION),
    graphNode(GRANDCHILD, 'ses-grandchild'),
  ],
  edges: [
    { id: 'e1', source: ROOT, target: CHILD, type: 'agent' },
    { id: 'e2', source: CHILD, target: GRANDCHILD, type: 'agent' },
  ],
};

type Params = Parameters<typeof useHistoryData>[0];

const baseParams = (overrides: Partial<Params> = {}): Params => ({
  graph,
  targetId: CHILD,
  rootId: ROOT,
  isLoading: false,
  isError: false,
  onClose: vi.fn(),
  ...overrides,
});

const renderHistoryData = (initial: Params) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook((props: Params) => useHistoryData(props), {
    initialProps: initial,
    wrapper,
  });
};

const message = (): SessionMessageInfo => ({
  id: 'm1',
  time: { created: 1 },
  type: 'user',
  text: 'hola',
});

describe('useHistoryData — composición del overlay (FR-010)', () => {
  beforeEach(() => {
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset();
    getSessionContext.mockReset().mockResolvedValue([]);
  });

  it('expone el nodo y su linaje del grafo, y compone preguntas y contexto con la sesión del nodo', async () => {
    listSessionForms.mockResolvedValue([
      formInfo({ id: 'f1', sessionID: CHILD_SESSION }),
    ]);
    getSessionForm.mockResolvedValue(
      formDetail({ id: 'f1', sessionID: CHILD_SESSION }),
    );
    getSessionContext.mockResolvedValue([message()]);

    const { result } = renderHistoryData(baseParams());

    expect(result.current.node?.id).toBe(CHILD);
    expect(result.current.lineage).toEqual({
      parentId: ROOT,
      childrenIds: [GRANDCHILD],
    });
    expect(result.current.missingId).toBeNull();

    await waitFor(() => expect(result.current.questions).toHaveLength(1));
    await waitFor(() => expect(result.current.context.messages).toHaveLength(1));

    // La sesión se deriva del nodo: las dos consultas la reciben como argumento.
    expect(listSessionForms).toHaveBeenCalledWith(CHILD_SESSION);
    expect(getSessionForm).toHaveBeenCalledWith(CHILD_SESSION, 'f1');
    expect(getSessionContext).toHaveBeenCalledWith(CHILD_SESSION);

    // `questions` lleva la forma resuelta del Inspector y `context` su estado de pantalla.
    expect(result.current.questions[0].state).toBe('pending');
    expect(result.current.context.isError).toBe(false);
    expect(result.current.context.isLoading).toBe(false);
  });

  it('sin targetId no resuelve nodo y no dispara ninguna consulta', () => {
    const { result } = renderHistoryData(baseParams({ targetId: null }));

    expect(result.current.node).toBeNull();
    expect(result.current.lineage).toEqual(EMPTY_LINEAGE);
    expect(result.current.missingId).toBeNull();
    expect(result.current.questions).toEqual([]);
    expect(result.current.context).toEqual({
      messages: [],
      isError: false,
      isLoading: false,
    });
    expect(listSessionForms).not.toHaveBeenCalled();
    expect(getSessionContext).not.toHaveBeenCalled();
  });

  it('con un targetId inexistente marca missingId (404 de la sesión) y no consulta datos', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHistoryData(
      baseParams({ targetId: GHOST, onClose }),
    );

    expect(result.current.node).toBeNull();
    expect(result.current.missingId).toBe(GHOST);
    expect(onClose).toHaveBeenCalled();
    expect(result.current.questions).toEqual([]);
    expect(result.current.context.messages).toEqual([]);
    expect(listSessionForms).not.toHaveBeenCalled();
    expect(getSessionContext).not.toHaveBeenCalled();

    // El llamador cierra el overlay (`targetId` nulo) y limpia el aviso; con el
    // objetivo aún ausente el aviso se volvería a marcar.
    rerender(baseParams({ targetId: null, onClose }));
    act(() => result.current.clearMissing());

    expect(result.current.missingId).toBeNull();
  });

  it('no marca el 404 mientras el grafo carga y lo marca al resolver', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHistoryData(
      baseParams({ targetId: GHOST, isLoading: true, onClose }),
    );

    expect(result.current.missingId).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    rerender(baseParams({ targetId: GHOST, isLoading: false, onClose }));

    expect(result.current.missingId).toBe(GHOST);
    expect(onClose).toHaveBeenCalled();
  });

  it('cierra el overlay al cambiar la raíz y no lo cierra si la raíz no cambia (FR-014)', () => {
    const onClose = vi.fn();
    const { rerender } = renderHistoryData(baseParams({ onClose }));

    expect(onClose).not.toHaveBeenCalled();

    rerender(baseParams({ rootId: 'other-root', onClose }));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    rerender(baseParams({ rootId: 'other-root', onClose }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('usa el sessionIdForForms explícito cuando el llamador lo pasa', async () => {
    const { result } = renderHistoryData(
      baseParams({ sessionIdForForms: OTHER_SESSION }),
    );

    await waitFor(() => expect(getSessionContext).toHaveBeenCalled());

    expect(listSessionForms).toHaveBeenCalledWith(OTHER_SESSION);
    expect(getSessionContext).toHaveBeenCalledWith(OTHER_SESSION);
    expect(result.current.node?.data.sessionId).toBe(CHILD_SESSION);
  });
});
