/**
 * Arnés compartido de integración (T003 de 012 — `tasks.md`).
 *
 * Reúne lo que las suites E2E de frontera de unidades
 * (`src/Infrastructure/specs/integration/`, T017–T023 y T028–T030) necesitan
 * para montar `WorkspacePage` **con el modelo y los hooks reales** y la red bajo
 * control del test:
 *
 * - Montaje: `createIntegrationQueryClient` (sin retry, `staleTime`/`gcTime`
 *   infinitos para que la caché sembrada no se recolecte) + `renderWorkspace`
 *   (rutas `/sessions/:id` y `/sessions`) en `QueryClientProvider`/`MemoryRouter`.
 * - Sembrado de caché: `seedSessions`, `seedSubtree`, `seedMessages`,
 *   `seedPermissions`, `seedForms`, `seedExecution` (y la escotilla
 *   `seedQueryData`), con las **mismas claves** que escribe `loadNodeContent` y
 *   parchea `eventReducer` (`queryKeys`).
 * - Doble del SDK: `serviceMock` / `createServiceMock` / `resetServiceMock`
 *   (superficie completa de `OpenCodeService` con valores vacíos por defecto).
 * - Mocks **por barrel**: `mockGraphBarrel`, `mockSessionsBarrel`,
 *   `mockChatBarrel`, `mockInspectorBarrel`, `mockHistoryBarrel`. Conservan los
 *   hooks reales (por import profundo o `vi.importActual`) y sustituyen **solo**
 *   los componentes pesados por marcadores identificables (`TESTID`) que
 *   exponen sus props en atributos `data-*`.
 *
 * El fichero **no** es `*.spec.tsx`: Vitest solo recolecta
 * `src/**\/*.{test,spec}.{ts,tsx}` (`vitest.config.ts`), así que este arnés no se
 * ejecuta como suite.
 *
 * Uso típico en un spec de integración (los `vi.mock` se hoistean, por eso los
 * factories importan el arnés de forma dinámica):
 *
 * ```tsx
 * import { beforeEach, describe, expect, it, vi } from 'vitest';
 * import { screen } from '@testing-library/react';
 *
 * vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
 *   const { serviceMock } = await import('./harness');
 *   return { opencodeService: serviceMock };
 * });
 * vi.mock('@app/Domains/Graph', async () => {
 *   const { mockGraphBarrel } = await import('./harness');
 *   return mockGraphBarrel();
 * });
 * vi.mock('@app/Domains/Sessions', async () => {
 *   const { mockSessionsBarrel } = await import('./harness');
 *   return mockSessionsBarrel();
 * });
 * vi.mock('@app/Domains/Chat', async () => {
 *   const { mockChatBarrel } = await import('./harness');
 *   return mockChatBarrel();
 * });
 * vi.mock('@app/Domains/Inspector', async () => {
 *   const { mockInspectorBarrel } = await import('./harness');
 *   return mockInspectorBarrel();
 * });
 * vi.mock('@app/Domains/History', async () => {
 *   const { mockHistoryBarrel } = await import('./harness');
 *   return mockHistoryBarrel();
 * });
 *
 * beforeEach(() => {
 *   resetServiceMock();
 * });
 *
 * it('...', async () => {
 *   const client = createIntegrationQueryClient();
 *   seedSessions(client, [buildSessionInfo()]);
 *   seedSubtree(client, [buildSessionInfo()]);
 *   seedDevice(client, false);
 *   await renderWorkspace(client);
 *   expect(screen.getByTestId(TESTID.agentGraph)).toBeInTheDocument();
 * });
 * ```
 *
 * `renderWorkspace` es asíncrono a propósito: `WorkspacePage` se importa de
 * forma diferida dentro de la función para que el arnés no participe del ciclo
 * de resolución de los `vi.mock` de los barrels (importarlo arriba haría que la
 * página —y sus barrels mockeados— se evaluaran **durante** la construcción del
 * mock).
 */
import { act, render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import type { ReactNode } from 'react';
import type {
  AgentInfo,
  FormDetail,
  FormInfo,
  PermissionRequest,
  SessionInfo,
  SessionStatus,
} from '@opencode/client';
import { STORE_KEY } from '@app/Application/Hooks';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { queryKeys } from '@app/Domains/queryKeys';
import type {
  TExecutionSignal,
  TGraphModel,
  TGraphNode,
} from '@app/Domains/Graph/Graph.entity';
import type { TSubtreeLoadResult } from '@app/Domains/Graph/lib/loadPlan/subtree';
import type { TLineageNav } from '@app/Domains/History/HistoryEntry.entity';
import type { OpenCodeService, TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';

/* -------------------------------------------------------------------------- */
/* Constantes y `data-testid` compartidos                                      */
/* -------------------------------------------------------------------------- */

/** Directorio por defecto de las sesiones del arnés. */
export const INTEGRATION_DIRECTORY = '/repo';

/** Sesión raíz abierta por defecto. */
export const INTEGRATION_SESSION_ID = 'ses_root';

/** Sesión hija (subagente) por defecto: segundo nodo del subárbol. */
export const INTEGRATION_CHILD_SESSION_ID = 'ses_child';

/**
 * `data-testid` de los marcadores. Los que ya son contrato de producción
 * (`chat-panel`, `agent-graph`, `inspector-panel`, …) conservan su valor
 * literal: los specs protegidos y `isFocusWithinChat` dependen de él.
 */
export const TESTID = {
  agentGraph: 'agent-graph',
  graphSkeleton: 'graph-skeleton',
  sessionSummaryBar: 'session-summary-bar',
  sessionList: 'session-list',
  sessionListSkeleton: 'session-list-skeleton',
  chatPanel: 'chat-panel',
  inspectorPanel: 'inspector-panel',
  historyModal: 'history-modal',
} as const;

/* -------------------------------------------------------------------------- */
/* Fixtures de sesión y caché                                                   */
/* -------------------------------------------------------------------------- */

/** `SessionInfo` mínimo y determinista; `overrides` completa cada caso. */
export const buildSessionInfo = (
  overrides: Partial<SessionInfo> = {},
): SessionInfo => ({
  id: INTEGRATION_SESSION_ID,
  projectID: 'proj',
  agent: 'develop',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  title: 'tarea',
  time: { created: 1, updated: 2 },
  location: { directory: INTEGRATION_DIRECTORY },
  ...overrides,
});

/**
 * Cliente de queries del arnés: sin retry y con `staleTime`/`gcTime` infinitos
 * para que la caché sembrada **antes** del render no se recolecte ni dispare
 * refetch antes de que la página la lea.
 */
export const createIntegrationQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

/** Fija la presentación (desktop/móvil) sembrando el store de `useDevice`. */
export const seedDevice = (client: QueryClient, isMobile: boolean): void => {
  client.setQueryData([STORE_KEY.isMobile], isMobile);
};

/** Escotilla para claves fuera de los seeds: `client.setQueryData` tipado. */
export const seedQueryData = <T,>(
  client: QueryClient,
  key: readonly unknown[],
  data: T,
): void => {
  client.setQueryData(key, data);
};

export interface TSeedSessionsOptions {
  directory?: string;
  /** Mapa global `sessionID → SessionStatus` (`sessions.status()`). */
  status?: Record<string, SessionStatus>;
  /** Catálogo de agentes del directorio (`agents.list(directory)`). */
  agents?: AgentInfo[];
  /** Corte del listado de raíces (`sessions.roots(directory)`). */
  truncated?: boolean;
}

/**
 * Siembra el listado de sesiones del directorio: `sessions.list` (rail),
 * `sessions.roots` (corte declarado que lee `GraphPane`) y `sessions.status` +
 * `agents.list`, las tres consultas que resuelve la fase estructural.
 */
export const seedSessions = (
  client: QueryClient,
  sessions: SessionInfo[] = [],
  {
    directory = INTEGRATION_DIRECTORY,
    status = {},
    agents = [],
    truncated = false,
  }: TSeedSessionsOptions = {},
): void => {
  client.setQueryData(queryKeys.sessions.list(directory), sessions);
  client.setQueryData(queryKeys.sessions.roots(directory), {
    sessions,
    truncated,
  });
  client.setQueryData(queryKeys.sessions.status(), status);
  client.setQueryData(queryKeys.agents.list(directory), agents);
};

export interface TSeedSubtreeOptions {
  directory?: string;
  sessionId?: string;
  truncated?: boolean;
  notFound?: boolean;
}

/**
 * Siembra el **origen estructural** del grafo: el subárbol de la sesión abierta
 * bajo `graph.for(directory, sessionId)` (contrato de subárbol §3). Con
 * `notFound: true` se ejerce el estado "sesión no encontrada" sin red.
 */
export const seedSubtree = (
  client: QueryClient,
  sessions: SessionInfo[] = [],
  {
    directory = INTEGRATION_DIRECTORY,
    sessionId = INTEGRATION_SESSION_ID,
    truncated = false,
    notFound = false,
  }: TSeedSubtreeOptions = {},
): void => {
  client.setQueryData<TSubtreeLoadResult>(
    queryKeys.graph.for(directory, sessionId),
    {
      sessions,
      truncated,
      loadedCount: sessions.length,
      notFound,
    },
  );
};

/**
 * Siembra los mensajes por sesión (`sessions.messages(id)`): la clave que
 * escribe el enriquecimiento y que alimenta métricas, invocaciones y contexto.
 */
export const seedMessages = (
  client: QueryClient,
  bySession: Record<string, TSessionMessage[]> = {},
): void => {
  for (const [sessionId, messages] of Object.entries(bySession)) {
    client.setQueryData(queryKeys.sessions.messages(sessionId), messages);
  }
};

export interface TSeedPermissionsOptions {
  /** Permisos por sesión (`permissions.for(id)`), los que fusiona cada nodo. */
  bySession?: Record<string, PermissionRequest[]>;
}

/**
 * Siembra la lista global de permisos (`permissions.list()`, que incluye los de
 * las sesiones hijas y alimenta la atención) y, opcionalmente, el permiso
 * sembrado por sesión que lee el enriquecimiento de cada nodo.
 */
export const seedPermissions = (
  client: QueryClient,
  permissions: PermissionRequest[] = [],
  { bySession = {} }: TSeedPermissionsOptions = {},
): void => {
  client.setQueryData(queryKeys.permissions.list(), permissions);
  for (const [sessionId, requests] of Object.entries(bySession)) {
    client.setQueryData(queryKeys.permissions.for(sessionId), requests);
  }
};

export interface TSeedFormsOptions {
  /** Formularios crudos por sesión (`sessions.forms(id)`). */
  bySession?: Record<string, FormInfo[]>;
  /** `FormDetail` por sesión, indexados por `form.id` (`[...forms(id), id]`). */
  details?: Record<string, FormDetail[]>;
  /** Preguntas resueltas por sesión (`sessions.questions(id)`, Inspector). */
  questions?: Record<string, TQuestionEntry[]>;
}

/**
 * Siembra los formularios en sus **tres** formas cacheadas: la lista cruda por
 * sesión (grafo/atención), el detalle por formulario (enriquecimiento, que
 * decide si una pregunta sigue `pending`) y las preguntas resueltas que consume
 * el Inspector/el histórico.
 */
export const seedForms = (
  client: QueryClient,
  {
    bySession = {},
    details = {},
    questions = {},
  }: TSeedFormsOptions = {},
): void => {
  for (const [sessionId, forms] of Object.entries(bySession)) {
    client.setQueryData(queryKeys.sessions.forms(sessionId), forms);
  }
  for (const [sessionId, formDetails] of Object.entries(details)) {
    for (const detail of formDetails) {
      client.setQueryData(
        [...queryKeys.sessions.forms(sessionId), detail.id],
        detail,
      );
    }
  }
  for (const [sessionId, entries] of Object.entries(questions)) {
    client.setQueryData(queryKeys.sessions.questions(sessionId), entries);
  }
};

/**
 * Siembra la señal de ejecución por sesión (`sessions.execution(id)`, mapa
 * `sessionID → TExecutionSignal`), tal como la deja `loadNodeContent` o un
 * evento en vivo.
 */
export const seedExecution = (
  client: QueryClient,
  bySession: Record<string, TExecutionSignal> = {},
): void => {
  for (const [sessionId, signal] of Object.entries(bySession)) {
    client.setQueryData<Record<string, TExecutionSignal>>(
      queryKeys.sessions.execution(sessionId),
      { [sessionId]: signal },
    );
  }
};

/* -------------------------------------------------------------------------- */
/* Doble del SDK                                                                */
/* -------------------------------------------------------------------------- */

/** Superficie completa de `OpenCodeService` con cada método espiado. */
export type TOpencodeServiceMock = {
  [K in keyof OpenCodeService]: Mock<OpenCodeService[K]>;
};

/** Crea un doble del SDK aislado (preferir `serviceMock` en el `vi.mock`). */
export const createServiceMock = (): TOpencodeServiceMock => ({
  listProjects: vi.fn<OpenCodeService['listProjects']>(),
  listSessions: vi.fn<OpenCodeService['listSessions']>(),
  listRootSessions: vi.fn<OpenCodeService['listRootSessions']>(),
  listChildSessions: vi.fn<OpenCodeService['listChildSessions']>(),
  getSession: vi.fn<OpenCodeService['getSession']>(),
  getActiveSessions: vi.fn<OpenCodeService['getActiveSessions']>(),
  getSessionMessages: vi.fn<OpenCodeService['getSessionMessages']>(),
  getHistoryMessages: vi.fn<OpenCodeService['getHistoryMessages']>(),
  getSessionDiff: vi.fn<OpenCodeService['getSessionDiff']>(),
  getSessionStats: vi.fn<OpenCodeService['getSessionStats']>(),
  getSessionContext: vi.fn<OpenCodeService['getSessionContext']>(),
  getSessionLog: vi.fn<OpenCodeService['getSessionLog']>(),
  exportSession: vi.fn<OpenCodeService['exportSession']>(),
  getSessionPermissions: vi.fn<OpenCodeService['getSessionPermissions']>(),
  getSessionInstructions: vi.fn<OpenCodeService['getSessionInstructions']>(),
  listSessionForms: vi.fn<OpenCodeService['listSessionForms']>(),
  getSessionForm: vi.fn<OpenCodeService['getSessionForm']>(),
  listSessionInbox: vi.fn<OpenCodeService['listSessionInbox']>(),
  listAgents: vi.fn<OpenCodeService['listAgents']>(),
  listModels: vi.fn<OpenCodeService['listModels']>(),
  getDefaultModel: vi.fn<OpenCodeService['getDefaultModel']>(),
  getMcpServers: vi.fn<OpenCodeService['getMcpServers']>(),
  subscribeEvents: vi.fn<OpenCodeService['subscribeEvents']>(),
});

/** Doble compartido por los specs vía `vi.mock(..., () => ({ opencodeService: serviceMock }))`. */
export const serviceMock: TOpencodeServiceMock = createServiceMock();

export interface TResetServiceMockOptions {
  /** Sesión que resuelve `getSession` (respaldo del `directory`). */
  session?: SessionInfo;
}

/**
 * Devuelve el doble a sus valores por defecto ("éxito vacío"): ninguna respuesta
 * trae datos, de modo que cada caso siembra **solo** lo que su frontera
 * necesita. `getSessionForm` queda sin implementación a propósito (se configura
 * en el caso que siembra formularios); con `listSessionForms` vacío nunca se
 * invoca.
 */
export const resetServiceMock = (
  service: TOpencodeServiceMock = serviceMock,
  { session = buildSessionInfo() }: TResetServiceMockOptions = {},
): void => {
  service.listProjects.mockReset();
  service.listProjects.mockResolvedValue([]);
  service.listSessions.mockReset();
  service.listSessions.mockResolvedValue([]);
  service.listRootSessions.mockReset();
  service.listRootSessions.mockResolvedValue({ sessions: [], truncated: false });
  service.listChildSessions.mockReset();
  service.listChildSessions.mockResolvedValue([]);
  service.getSession.mockReset();
  service.getSession.mockResolvedValue(session);
  service.getActiveSessions.mockReset();
  service.getActiveSessions.mockResolvedValue({});
  service.getSessionMessages.mockReset();
  service.getSessionMessages.mockResolvedValue([]);
  service.getHistoryMessages.mockReset();
  service.getHistoryMessages.mockResolvedValue({
    messages: [],
    nextCursor: null,
  });
  service.getSessionContext.mockReset();
  service.getSessionContext.mockResolvedValue([]);
  service.getSessionDiff.mockReset();
  service.getSessionStats.mockReset();
  service.exportSession.mockReset();
  service.getSessionInstructions.mockReset();
  service.getSessionInstructions.mockResolvedValue([]);
  service.getSessionLog.mockReset();
  service.getSessionLog.mockResolvedValue([]);
  service.getSessionPermissions.mockReset();
  service.getSessionPermissions.mockResolvedValue([]);
  service.listSessionForms.mockReset();
  service.listSessionForms.mockResolvedValue([]);
  service.getSessionForm.mockReset();
  service.listSessionInbox.mockReset();
  service.listSessionInbox.mockResolvedValue([]);
  service.listAgents.mockReset();
  service.listAgents.mockResolvedValue([]);
  service.listModels.mockReset();
  service.listModels.mockResolvedValue([]);
  service.getDefaultModel.mockReset();
  service.getDefaultModel.mockResolvedValue(null);
  service.getMcpServers.mockReset();
  service.getMcpServers.mockResolvedValue([]);
  service.subscribeEvents.mockReset();
};

/* -------------------------------------------------------------------------- */
/* Montaje                                                                      */
/* -------------------------------------------------------------------------- */

export interface TRenderWorkspaceOptions {
  /** Sesión de la ruta (`/sessions/:id`). */
  sessionId?: string;
  /** Entradas del router; por defecto la sesión abierta. */
  initialEntries?: string[];
}

/**
 * Monta `WorkspacePage` en la ruta `/sessions/:id` (con la salida `/sessions` al
 * listado) dentro de `QueryClientProvider` + `MemoryRouter`. La importación de la
 * página es diferida (ver cabecera del módulo).
 */
export const renderWorkspace = async (
  client: QueryClient,
  {
    sessionId = INTEGRATION_SESSION_ID,
    initialEntries = [`/sessions/${sessionId}`],
  }: TRenderWorkspaceOptions = {},
): Promise<RenderResult> => {
  const { WorkspacePage } = await import('../../WorkspacePage');

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/sessions/:id" element={<WorkspacePage />} />
          <Route
            path="/sessions"
            element={<div data-testid="sessions-list-route" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Deja correr un turno de idle/`setTimeout` (un lote del enriquecimiento). */
export const flushIdle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/* -------------------------------------------------------------------------- */
/* Marcadores de presentación                                                   */
/* -------------------------------------------------------------------------- */

export interface TAgentGraphMarkerProps {
  graph?: TGraphModel;
  selectedNodeId?: string | null;
  attentionNodeIds?: ReadonlySet<string>;
  onSelectNode?: (id: string) => void;
  onClearSelection?: () => void;
  onOpenHistory?: (id: string) => void;
}

/**
 * Marcador de `AgentGraph` (sustituye React Flow): expone la selección, el
 * realce por atención y el `enrichment` de cada nodo (`data-nodes`), y ofrece
 * controles para seleccionar/limpiar/abrir histórico desde el propio grafo.
 */
export const AgentGraphMarker = ({
  graph,
  selectedNodeId = null,
  attentionNodeIds,
  onSelectNode,
  onClearSelection,
  onOpenHistory,
}: TAgentGraphMarkerProps) => {
  const firstId = graph?.nodes[0]?.id ?? '';

  return (
    <div
      data-testid={TESTID.agentGraph}
      data-selected={selectedNodeId ?? ''}
      data-attention={[...(attentionNodeIds ?? [])].sort().join(',')}
      data-nodes={JSON.stringify(
        (graph?.nodes ?? []).map((node) => ({
          id: node.id,
          enrichment: node.data.enrichment ?? null,
        })),
      )}
    >
      <button type="button" onClick={() => onSelectNode?.(firstId)}>
        Seleccionar nodo
      </button>
      <button type="button" onClick={() => onClearSelection?.()}>
        Limpiar selección
      </button>
      <button type="button" onClick={() => onOpenHistory?.(firstId)}>
        Abrir histórico
      </button>
    </div>
  );
};

/** Marcador de `GraphSkeleton` (estado de carga de la fase estructural). */
export const GraphSkeletonMarker = () => (
  <div data-testid={TESTID.graphSkeleton} />
);

export interface TSessionSummaryBarMarkerProps {
  summary?: { sessionID?: string; cost?: number; tokens?: number } | null;
}

/** Marcador de `SessionSummaryBar`: expone el resumen recibido. */
export const SessionSummaryBarMarker = ({
  summary,
}: TSessionSummaryBarMarkerProps) => (
  <div
    data-testid={TESTID.sessionSummaryBar}
    data-session-id={summary?.sessionID ?? ''}
  />
);

export interface TSessionListMarkerProps {
  groups?: unknown[];
  selectedId?: string | null;
  attentionByRoot?: Record<string, number>;
}

/**
 * Marcador de `SessionList`: expone los pendientes por raíz tal como los
 * recibe el rail (`data-attention`), sin montar las tarjetas.
 */
export const SessionListMarker = ({
  groups,
  selectedId = null,
  attentionByRoot,
}: TSessionListMarkerProps) => (
  <div
    data-testid={TESTID.sessionList}
    data-selected={selectedId ?? ''}
    data-group-count={groups?.length ?? 0}
    data-attention={JSON.stringify(attentionByRoot ?? {})}
  />
);

/** Marcador de `SessionListSkeleton`. */
export const SessionListSkeletonMarker = () => (
  <div data-testid={TESTID.sessionListSkeleton} />
);

export interface TChatPanelMarkerProps {
  sessionId?: string;
  directory?: string | null;
  selectionSeed?: unknown;
  showReasoning?: boolean;
  pending?: unknown;
  attention?: unknown;
}

/**
 * Marcador de `ChatPanel`: expone la sesión, el directorio, la semilla de
 * selección, los pendientes de la bandeja y la atención recibidas; incluye un
 * `textarea` (`aria-label="Mensaje"`) para poder enfocar el panel y ejercer la
 * coordinación de `Escape`.
 */
export const ChatPanelMarker = ({
  sessionId = '',
  directory = null,
  selectionSeed,
  showReasoning = false,
  pending,
  attention,
}: TChatPanelMarkerProps) => (
  <div
    data-testid={TESTID.chatPanel}
    data-session-id={sessionId}
    data-directory={directory ?? ''}
    data-selection={JSON.stringify(selectionSeed ?? {})}
    data-show-reasoning={String(showReasoning)}
    data-pending={JSON.stringify(pending ?? [])}
    data-attention={JSON.stringify(attention ?? [])}
  >
    <textarea aria-label="Mensaje" />
  </div>
);

export interface TInspectorPanelMarkerProps {
  node?: TGraphNode | null;
  parallelPeers?: TGraphNode[];
  invokedBy?: TGraphNode | null;
}

/**
 * Marcador de `InspectorPanel`: expone el nodo inspeccionado y su `enrichment`
 * (frontera U6↔U3). El control de pantalla completa y el tablist siguen viviendo
 * en `InspectorPane` (real).
 */
export const InspectorPanelMarker = ({
  node,
  parallelPeers,
  invokedBy,
}: TInspectorPanelMarkerProps) => (
  <div
    data-testid={TESTID.inspectorPanel}
    data-node={node?.data.sessionId ?? ''}
    data-enrichment={node?.data.enrichment ?? 'none'}
    data-peer-count={parallelPeers?.length ?? 0}
    data-invoked-by={invokedBy?.id ?? ''}
  />
);

export interface THistoryModalMarkerProps {
  node?: TGraphNode | null;
  lineage?: TLineageNav;
  questions?: TQuestionEntry[];
  onClose?: () => void;
  onNavigate?: (sessionId: string) => void;
  renderCompactionContext?: () => ReactNode;
}

/**
 * Marcador de `HistoryModal`: expone el nodo, el linaje y las preguntas del
 * histórico, y monta el contexto de compactación que le entrega `HistoryOverlay`
 * (frontera U2↔U7/U8).
 */
export const HistoryModalMarker = ({
  node,
  lineage,
  questions,
  onClose,
  onNavigate,
  renderCompactionContext,
}: THistoryModalMarkerProps) => (
  <div
    data-testid={TESTID.historyModal}
    data-node={node?.id ?? ''}
    data-enrichment={node?.data.enrichment ?? 'none'}
    data-question-count={questions?.length ?? 0}
    data-parent={lineage?.parentId ?? ''}
    data-children={(lineage?.childrenIds ?? []).join(',')}
  >
    <button type="button" onClick={() => onClose?.()}>
      Cerrar histórico
    </button>
    <button
      type="button"
      onClick={() => {
        if (node) onNavigate?.(node.id);
      }}
    >
      Navegar al nodo
    </button>
    {renderCompactionContext?.() ?? null}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Mocks por barrel                                                             */
/* -------------------------------------------------------------------------- */

/**
 * `@app/Domains/Graph`: se sustituyen **solo** los componentes que montan React
 * Flow por marcadores. Los hooks y funciones puras que consume el árbol de
 * `Infrastructure` (`useGraphModel`, `useNow`, `useChainSelection`,
 * `useFollowMode`, `summarizeSession`, `isActiveStatus`) se conservan **reales**
 * —importados por ruta profunda, sin cargar `@xyflow/react`— para que las suites
 * E2E ejerzan el modelo por fases de verdad.
 *
 * Si el refactor hace que `Infrastructure` consuma otro export del barrel de
 * `Graph`, hay que añadirlo aquí (y solo entonces).
 */
export const mockGraphBarrel = async (): Promise<
  Record<string, unknown>
> => {
  const [
    { useGraphModel },
    { useNow },
    { useChainSelection },
    { useFollowMode },
    { summarizeSession },
    { isActiveStatus },
  ] = await Promise.all([
    import('@app/Domains/Graph/Hooks/useGraphModel'),
    import('@app/Domains/Graph/Hooks/useNow'),
    import('@app/Domains/Graph/Hooks/useChainSelection'),
    import('@app/Domains/Graph/Hooks/useFollowMode'),
    import('@app/Domains/Graph/lib/deriveMetrics'),
    import('@app/Domains/Graph/lib/nodeStatus'),
  ]);

  return {
    AgentGraph: AgentGraphMarker,
    GraphSkeleton: GraphSkeletonMarker,
    SessionSummaryBar: SessionSummaryBarMarker,
    isActiveStatus,
    summarizeSession,
    useChainSelection,
    useFollowMode,
    useGraphModel,
    useNow,
  };
};

/**
 * `@app/Domains/Sessions`: se conservan los hooks reales (`useRootSessions`,
 * `useSessionDirectory`, `useGetSessionStatus`) y las constantes de rutas; solo
 * el listado se sustituye por marcadores.
 */
export const mockSessionsBarrel = async (): Promise<
  Record<string, unknown>
> => {
  const actual =
    await vi.importActual<typeof import('@app/Domains/Sessions')>(
      '@app/Domains/Sessions',
    );

  return {
    ...actual,
    SessionList: SessionListMarker,
    SessionListSkeleton: SessionListSkeletonMarker,
  };
};

/**
 * `@app/Domains/Chat`: se conserva el dominio real (incluido
 * `ChatAttentionBadge`, que los specs de badge sí montan) y solo el panel se
 * sustituye por el marcador.
 */
export const mockChatBarrel = async (): Promise<Record<string, unknown>> => {
  const actual = await vi.importActual<typeof import('@app/Domains/Chat')>(
    '@app/Domains/Chat',
  );

  return { ...actual, ChatPanel: ChatPanelMarker };
};

/**
 * `@app/Domains/Inspector`: se conservan los hooks reales
 * (`useSessionContext`/`useSessionForms`, que leen la caché sembrada) y se
 * sustituye el panel por el marcador.
 */
export const mockInspectorBarrel = async (): Promise<
  Record<string, unknown>
> => {
  const { useSessionContext, useSessionForms } = await import(
    '@app/Domains/Inspector/Inspector.service'
  );

  return {
    InspectorPanel: InspectorPanelMarker,
    useSessionContext,
    useSessionForms,
  };
};

/**
 * `@app/Domains/History`: se conserva `useHistory` **real** (estado de vista
 * local, que los specs abren desde el grafo) y se sustituye el modal por el
 * marcador.
 */
export const mockHistoryBarrel = async (): Promise<Record<string, unknown>> => {
  const { useHistory } = await import('@app/Domains/History/Hooks/useHistory');

  return { HistoryModal: HistoryModalMarker, useHistory };
};
