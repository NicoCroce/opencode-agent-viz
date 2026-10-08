import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryKeys } from '../../../queryKeys';
import {
  DEFAULT_DIRECTORY,
  assistantMessage,
  session,
} from '../../lib/specs/fixtures';
import { useGraphModel, type UseGraphModelResult } from '../useGraphModel';

/**
 * Spec de contrato del modelo por fases (criterios L7..L8 del
 * `contracts/graph-loading-contract.md`):
 *
 * - L8: `useGraphModel` conserva **exactamente** la firma y la forma pública de
 *   `UseGraphModelResult` (verificado en runtime y por compilación `tsc`).
 * - L7: la revisita de una sesión ya visitada no repite la carga; todos los ids
 *   `ready` entran en `skippedIds` (sin recarga de contenido, SC-003/SC-008).
 *
 * El observable de "sin recarga" son las llamadas a los loaders de contenido:
 * con el caché de la primera visita intacto, una revisita no debe volver a
 * invocarlos. Este spec se escribe contra el contrato congelado y es la red de
 * seguridad del refactor de `useGraphModel` (T019).
 */

const {
  listSessions,
  listAgents,
  getSessionMessages,
  getSessionPermissions,
  getSessionLog,
  listSessionForms,
  getSessionForm,
  listSessionInbox,
} = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listAgents: vi.fn(),
  getSessionMessages: vi.fn(),
  getSessionPermissions: vi.fn(),
  getSessionLog: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  listSessionInbox: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    listSessions,
    listAgents,
    getSessionMessages,
    getSessionPermissions,
    getSessionLog,
    listSessionForms,
    getSessionForm,
    listSessionInbox,
  },
}));

const ROOT_ID = 'ses-root';
const CHILD_IDS = ['ses-child-a', 'ses-child-b'] as const;
const SUBTREE_IDS = [ROOT_ID, ...CHILD_IDS];

/** Claves públicas exactas de `UseGraphModelResult` (contrato §1, L8). */
const PUBLIC_RESULT_KEYS: ReadonlyArray<keyof UseGraphModelResult> = [
  'graph',
  'parallelGroups',
  'executionPlan',
  'activeNodeId',
  'isLoading',
  'isError',
  'error',
];

/**
 * Loaders que consume el enriquecimiento. En la revisita de una sesión ya
 * enriquecida (`skippedIds` completos) ninguno debe volver a invocarse.
 */
const CONTENT_LOADERS = [
  getSessionMessages,
  getSessionPermissions,
  getSessionLog,
  listSessionForms,
  getSessionForm,
  listSessionInbox,
] as const;

const contentCallCounts = (): number[] =>
  CONTENT_LOADERS.map((loader) => loader.mock.calls.length);

const buildSubtree = () => [
  session(ROOT_ID),
  session(CHILD_IDS[0], { parentID: ROOT_ID }),
  session(CHILD_IDS[1], { parentID: ROOT_ID }),
];

/**
 * Cliente que sobrevive al desmontaje (`gcTime: Infinity`) para que la revisita
 * comparta exactamente el mismo caché que la primera visita.
 */
const createRevisitClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const renderGraph = (queryClient: QueryClient, sessionId: string = ROOT_ID) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGraphModel(sessionId, DEFAULT_DIRECTORY), {
    wrapper,
  });
};

describe('useGraphModel — contrato de carga (L7..L8)', () => {
  beforeEach(() => {
    listSessions.mockResolvedValue(buildSubtree());
    listAgents.mockResolvedValue([]);
    getSessionMessages.mockResolvedValue([assistantMessage()]);
    getSessionPermissions.mockResolvedValue([]);
    getSessionLog.mockResolvedValue([]);
    listSessionForms.mockResolvedValue([]);
    getSessionForm.mockResolvedValue(undefined);
    listSessionInbox.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('conserva la forma pública de UseGraphModelResult (L8)', async () => {
    const { result } = renderGraph(createRevisitClient());

    await waitFor(() =>
      expect(result.current.graph.nodes).toHaveLength(SUBTREE_IDS.length),
    );

    // Compilación: el retorno sigue siendo asignable a la interfaz pública (tsc).
    const shape: UseGraphModelResult = result.current;

    expect(Object.keys(shape).sort()).toEqual([...PUBLIC_RESULT_KEYS].sort());
    expect(Array.isArray(shape.graph.nodes)).toBe(true);
    expect(Array.isArray(shape.graph.edges)).toBe(true);
    expect(Array.isArray(shape.parallelGroups)).toBe(true);
    expect(shape.executionPlan).toBeDefined();
    expect(
      shape.activeNodeId === null || typeof shape.activeNodeId === 'string',
    ).toBe(true);
    expect(typeof shape.isLoading).toBe('boolean');
    expect(typeof shape.isError).toBe('boolean');
    expect(shape.error === null || shape.error instanceof Error).toBe(true);
  });

  it('sirve la estructura desde caché y salta todos los ids ready en la revisita (L7)', async () => {
    const queryClient = createRevisitClient();

    // --- Primera visita: el enriquecimiento carga el contenido de cada id. ---
    const first = renderGraph(queryClient);
    await waitFor(() =>
      expect(first.result.current.graph.nodes).toHaveLength(
        SUBTREE_IDS.length,
      ),
    );
    await waitFor(() =>
      expect(getSessionMessages).toHaveBeenCalledTimes(SUBTREE_IDS.length),
    );
    expect(contentCallCounts()).toEqual([3, 3, 3, 3, 0, 3]);
    // Al completar la primera visita, todo el subárbol queda `ready`.
    expect(
      first.result.current.graph.nodes.every(
        (node) => node.data.enrichment === 'ready',
      ),
    ).toBe(true);

    first.unmount();
    const callsAfterFirstVisit = contentCallCounts();

    // --- Revisita: misma sesión de trabajo, mismo caché. ---
    const second = renderGraph(queryClient);

    // La estructura está disponible de inmediato (desde caché), sin esqueleto.
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.graph.nodes).toHaveLength(SUBTREE_IDS.length);
    expect(
      second.result.current.graph.nodes.every(
        (node) => node.data.enrichment === 'ready',
      ),
    ).toBe(true);

    // Deja correr cualquier efecto/fetch pendiente antes de medir.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // `skippedIds` completos: ningún loader de contenido se vuelve a invocar.
    expect(contentCallCounts()).toEqual(callsAfterFirstVisit);
    expect(getSessionMessages).toHaveBeenCalledTimes(SUBTREE_IDS.length);
  });

  it('solo carga los ids que no están ready: skippedIds = readyIds (L7, SC-008)', async () => {
    const queryClient = createRevisitClient();
    const [readyId, pendingId] = CHILD_IDS;

    // Simula una sesión ya enriquecida: el contenido de `readyId` está en caché.
    queryClient.setQueryData(queryKeys.sessions.messages(readyId), [
      assistantMessage(),
    ]);
    queryClient.setQueryData(queryKeys.permissions.for(readyId), []);
    queryClient.setQueryData(queryKeys.sessions.log(readyId), []);
    queryClient.setQueryData(queryKeys.sessions.forms(readyId), []);
    queryClient.setQueryData(queryKeys.sessions.inbox(readyId), []);

    const { result } = renderGraph(queryClient);
    await waitFor(() =>
      expect(result.current.graph.nodes).toHaveLength(SUBTREE_IDS.length),
    );
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(2));

    // `readyId` queda en `skippedIds`: no se vuelve a pedir ninguno de sus datos.
    const requested = getSessionMessages.mock.calls
      .map(([id]) => id as string)
      .sort();
    expect(requested).toEqual([ROOT_ID, pendingId].sort());
    expect(getSessionPermissions).not.toHaveBeenCalledWith(readyId);
    expect(getSessionLog).not.toHaveBeenCalledWith(readyId);
    expect(listSessionForms).not.toHaveBeenCalledWith(readyId);
    expect(listSessionInbox).not.toHaveBeenCalledWith(readyId);
  });
});
