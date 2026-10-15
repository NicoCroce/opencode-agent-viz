import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { SessionStatus } from '@opencode/client';
import type {
  TExecutionSignal,
  TGraphModel,
} from '@app/Domains/Graph/Graph.entity';
import { useGraphModel } from '@app/Domains/Graph/Hooks/useGraphModel';
import { assistantMessage } from '@app/Domains/Graph/lib/specs/fixtures';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  TESTID,
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedExecution,
  seedMessages,
  seedSessions,
  seedSubtree,
} from './harness';

/**
 * E2E de frontera **U6↔U5** (T030, FR-018/FR-019): el estado de sesión llega al
 * nodo del grafo.
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido)
 * para ejercer la cadena completa de esta frontera:
 *
 *   `useGetSessionStatus` (`sessions.status`, U5) ┐
 *   `sessions.execution(id)` (señal, U5)         ├→ `enrichNodeData` (U6) → nodo
 *   mensajes del nodo (U6)                       ┘
 *
 * Los dos suministros de U5 alimentan **campos distintos** de la fusión y se
 * distinguen por su origen: el mapa global resuelve el estado (`retrying`) y el
 * conteo de reintentos/`retry`, mientras que la señal por sesión resuelve
 * `compacting` (o `interrupted`/terminales). El caso negativo obligatorio
 * (`sesión sin estado ni señal`, dato inexistente) comprueba que el nodo se
 * enriquece igual, **sin** romper, **sin** referencia de agente y **sin**
 * degradar `enrichment`.
 *
 * El grafo se sustituye por el marcador del arnés (`AgentGraphMarker`), que
 * expone el `enrichment` de cada nodo en `data-nodes`: eso basta para afirmar
 * que el nodo se enriqueció por el camino real, pero **no** el payload del
 * estado de sesión (estado, `retry`, reintentos o referencia de latencia), que
 * los marcadores no publican. Por eso el payload se lee con una **sonda del
 * modelo** (`useGraphModel`, el mismo hook que consume la página, importado por
 * ruta profunda) montada sobre el **mismo `QueryClient`**: no hay doble ni
 * reimplementación de la fusión, se lee exactamente el modelo que la página
 * tiene en pantalla (mismo patrón que la `EnrichmentProbe` de
 * `useGraphEnrichment.spec.tsx`).
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock } = await import('./harness');
  return { opencodeService: serviceMock };
});
vi.mock('@app/Domains/Graph', async () => {
  const { mockGraphBarrel } = await import('./harness');
  return mockGraphBarrel();
});
vi.mock('@app/Domains/Sessions', async () => {
  const { mockSessionsBarrel } = await import('./harness');
  return mockSessionsBarrel();
});
vi.mock('@app/Domains/Chat', async () => {
  const { mockChatBarrel } = await import('./harness');
  return mockChatBarrel();
});
vi.mock('@app/Domains/Inspector', async () => {
  const { mockInspectorBarrel } = await import('./harness');
  return mockInspectorBarrel();
});
vi.mock('@app/Domains/History', async () => {
  const { mockHistoryBarrel } = await import('./harness');
  return mockHistoryBarrel();
});

/** Estado global de reintento de la sesión abierta (suministro de U5). */
const RETRY_STATUS: SessionStatus = {
  type: 'retry',
  attempt: 2,
  message: 'rate limited',
  next: 1_234,
};

/** Señal por sesión de la hija: compactación en curso (suministro de U5). */
const COMPACTION_SIGNAL: TExecutionSignal = {
  retry: null,
  compaction: 'running',
  outcome: null,
  interruptReason: null,
};

/** Enriquecimiento del nodo tal como lo expone el marcador del grafo. */
const enrichmentOf = (marker: HTMLElement, nodeId: string): string | null => {
  const nodes = JSON.parse(marker.getAttribute('data-nodes') ?? '[]') as Array<{
    id: string;
    enrichment: string | null;
  }>;
  return nodes.find((node) => node.id === nodeId)?.enrichment ?? null;
};

/**
 * Sonda del modelo **enriquecido**: el mismo hook de la página (`useGraphModel`)
 * sobre el mismo `QueryClient`, para leer el payload de esta frontera.
 */
let latestModel: TGraphModel | null = null;

const StatusModelProbe = () => {
  const { graph } = useGraphModel(
    INTEGRATION_SESSION_ID,
    INTEGRATION_DIRECTORY,
    { isLoading: false, isError: false },
  );

  useEffect(() => {
    latestModel = graph;
  });

  return null;
};

const mountStatusModelProbe = (client: QueryClient): void => {
  render(
    <QueryClientProvider client={client}>
      <StatusModelProbe />
    </QueryClientProvider>,
  );
};

const nodeOf = (nodeId: string) =>
  latestModel?.nodes.find((node) => node.id === nodeId) ?? null;

/** Espera a que la sonda haya capturado el modelo (tras el primer commit). */
const waitForModel = async (): Promise<void> => {
  await waitFor(() => expect(latestModel).not.toBeNull());
};

beforeEach(() => {
  latestModel = null;
  resetServiceMock();
});

/**
 * Margen explícito para el E2E de frontera: monta la página real, la sonda del
 * modelo y espera el flush del arné; sufre timeout bajo carga con el límite por
 * defecto de Vitest (5 s). 20 s es holgado (>2× lo observado) y no debilita
 * ninguna aserción: sólo evita el falso fallo por timeout.
 */
const INTEGRATION_TIMEOUT_MS = 20_000;

describe('integración U6↔U5 — estado de sesión → nodo (T030)', () => {
  it('funde el estado global y la señal de ejecución en el nodo enriquecido', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: INTEGRATION_CHILD_SESSION_ID,
      parentID: INTEGRATION_SESSION_ID,
      agent: 'explore',
    });
    // U5: el mapa global solo conoce a la raíz; la hija solo trae señal.
    seedSessions(client, [root], {
      status: { [INTEGRATION_SESSION_ID]: RETRY_STATUS },
    });
    seedSubtree(client, [root, child]);
    // Ambos nodos ya tienen contenido en caché ⇒ se enriquecen en el render.
    seedMessages(client, {
      [INTEGRATION_SESSION_ID]: [assistantMessage()],
      [INTEGRATION_CHILD_SESSION_ID]: [],
    });
    seedExecution(client, { [INTEGRATION_CHILD_SESSION_ID]: COMPACTION_SIGNAL });
    seedDevice(client, false);

    await renderWorkspace(client);
    await flushIdle();

    const graphMarker = await screen.findByTestId(TESTID.agentGraph);

    // El nodo se enriquece con el estado y la señal presentes (no se degrada).
    expect(enrichmentOf(graphMarker, INTEGRATION_SESSION_ID)).toBe('ready');
    expect(enrichmentOf(graphMarker, INTEGRATION_CHILD_SESSION_ID)).toBe('ready');

    mountStatusModelProbe(client);
    await waitForModel();

    // La raíz no tiene señal: su estado sale del mapa global (`sessions.status`).
    expect(
      client.getQueryData(queryKeys.sessions.execution(INTEGRATION_SESSION_ID)),
    ).toBeUndefined();
    const rootNode = nodeOf(INTEGRATION_SESSION_ID);
    expect(rootNode?.data.status).toBe('retrying');
    expect(rootNode?.data.retry).toEqual({ attempt: 2, next: 1_234 });
    // El reintento del estado se suma a los del mensaje (base 0).
    expect(rootNode?.data.metrics.retryCount).toBe(2);
    // Las métricas del contenido se conservan al aplicar el estado.
    expect(rootNode?.data.metrics.durationMs).toBe(3);
    expect(rootNode?.data.enrichment).toBe('ready');

    // La hija no está en el mapa: su estado sale de la señal por sesión.
    const childNode = nodeOf(INTEGRATION_CHILD_SESSION_ID);
    expect(childNode?.data.status).toBe('compacting');
    expect(childNode?.data.retry).toBeNull();
    expect(childNode?.data.metrics.retryCount).toBe(0);
    expect(childNode?.data.enrichment).toBe('ready');
  });

  it('sin estado ni señal (dato inexistente) el nodo se enriquece sin romper ni degradar `enrichment`', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: INTEGRATION_CHILD_SESSION_ID,
      parentID: INTEGRATION_SESSION_ID,
    });
    // Ni `sessions.status` ni `sessions.execution(id)` tienen entrada para la
    // sesión: el dato del estado es inexistente (404 lógico de esta frontera).
    seedSessions(client, [root], { status: {} });
    seedSubtree(client, [root, child]);
    seedMessages(client, {
      [INTEGRATION_SESSION_ID]: [],
      [INTEGRATION_CHILD_SESSION_ID]: [],
    });
    seedDevice(client, false);

    await renderWorkspace(client);
    await flushIdle();

    const graphMarker = await screen.findByTestId(TESTID.agentGraph);

    // El nodo se enriquece igual y la vista sigue montada (nada se rompe).
    expect(enrichmentOf(graphMarker, INTEGRATION_SESSION_ID)).toBe('ready');
    expect(enrichmentOf(graphMarker, INTEGRATION_CHILD_SESSION_ID)).toBe('ready');
    expect(screen.getByTestId(TESTID.inspectorPanel)).toBeInTheDocument();

    mountStatusModelProbe(client);
    await waitForModel();

    const childNode = nodeOf(INTEGRATION_CHILD_SESSION_ID);
    expect(childNode?.data.enrichment).toBe('ready');
    // Sin estado activo ni señal, el estado cae al derivado de la actividad.
    expect(childNode?.data.status).toBe('created');
    expect(childNode?.data.retry).toBeNull();
    expect(childNode?.data.interruptReason).toBeNull();
    expect(childNode?.data.metrics.retryCount).toBe(0);
    // Sin respuestas no hay ritmo de modelo de referencia ni anomalías.
    expect(childNode?.data.context?.latency?.paces).toEqual([]);
    expect(childNode?.data.context?.latency?.anomalies).toEqual([]);
  });
}, INTEGRATION_TIMEOUT_MS);
