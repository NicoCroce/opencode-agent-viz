import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import type { SessionInfo } from '@opencode/client';
import type {
  TEnrichmentState,
  TGraphModel,
  TGraphNode,
} from '@app/Domains/Graph/Graph.entity';
import { assistantMessage } from '@app/Domains/Graph/lib/specs/fixtures';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedSessions,
  seedSubtree,
  serviceMock,
  TESTID,
  type TAgentGraphMarkerProps,
} from './harness';

/**
 * E2E de frontera U6↔U3 (T029, US2): **modelo enriquecido → vista**.
 *
 * Monta `WorkspacePage` con el **modelo real** (`useGraphStructure` →
 * `useGraphEnrichment`, vía `useGraphModel`; contrato de carga §1) y el SDK bajo
 * control del test, apoyándose en el arnés compartido de la carpeta
 * (`harness.tsx`): caché sembrada (`graph.for(directory, sessionId)`,
 * `sessions.status`, `agents.list`) y barrels pesados de presentación
 * sustituidos por marcadores que exponen en `data-*` lo que reciben.
 *
 * Qué fija (FR-013, SC-006; data-model §2.1/§2.2):
 *
 * 1. **Camino feliz**: al completarse los lotes de idle, el **mismo**
 *    `TGraphModel` enriquecido llega a los dos consumidores de la vista —
 *    `GraphPane` (cada nodo con `enrichment: 'ready'`) e `InspectorPane` (el
 *    nodo inspeccionado por defecto, la raíz) — y las `edges` entregadas son las
 *    de la estructura **por referencia**: el enriquecimiento no reconstruye la
 *    topología. Los datos del nodo salen del contenido cargado por el lote
 *    (`metrics.cost`), no solo de la marca `ready`.
 * 2. **Caso negativo**: un nodo **sin mensajes** (su lectura de contenido falla)
 *    se queda `pending`; al recomputarse el modelo conserva la **referencia
 *    previa** (SC-006: sin `data` nuevo no hay re-render ni re-layout) y su
 *    `ready` nunca se degrada a `pending` — el nodo que ya estaba listo sigue
 *    listo y el grafo no cae en un estado de error.
 *
 * El marcador de `AgentGraph` del arnés expone `data-nodes` (id + `enrichment`)
 * pero no las aristas ni las referencias de nodo, así que este spec **envuelve
 * ese mismo marcador** para observar el `graph` entregado; `edges`, identidad de
 * nodos y `data-nodes` son la superficie observable de la frontera.
 */

/**
 * Modelos entregados a `AgentGraph`, en orden de render. Es la observación
 * externa que el arnés no puede exponer por `data-*`.
 */
const delivered = vi.hoisted(() => ({ graphs: [] as TGraphModel[] }));

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: service } = await import('./harness');
  return { opencodeService: service };
});

/**
 * `@app/Domains/Graph`: se conservan **resueltos por el arnés** los hooks reales
 * (`useGraphModel`, `useChainSelection`, `useFollowMode`, …) y los marcadores de
 * presentación; solo se envuelve `AgentGraph` para registrar el `graph` que
 * recibe la vista antes de delegar en el marcador del arnés.
 */
vi.mock('@app/Domains/Graph', async () => {
  const React = await import('react');
  const { AgentGraphMarker, mockGraphBarrel } = await import('./harness');
  const barrel = await mockGraphBarrel();

  return {
    ...barrel,
    AgentGraph: (props: TAgentGraphMarkerProps) => {
      if (props.graph !== undefined) delivered.graphs.push(props.graph);
      return React.createElement(AgentGraphMarker, props);
    },
  };
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

const ROOT = INTEGRATION_SESSION_ID;
const CHILD = INTEGRATION_CHILD_SESSION_ID;

/** Hijo de subagente del subárbol: segundo nodo, con arista desde la raíz. */
const childSession = (): SessionInfo =>
  buildSessionInfo({
    id: CHILD,
    parentID: ROOT,
    title: 'subtarea',
    time: { created: 3, updated: 4 },
  });

/** Nodo del modelo entregado, con error explícito si el id no está. */
const requireNode = (graph: TGraphModel, id: string): TGraphNode => {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  if (node === undefined) {
    throw new Error(`El modelo entregado a la vista no contiene el nodo ${id}`);
  }
  return node;
};

/** `enrichment` por nodo del modelo (`TGraphModel`). */
const enrichmentById = (
  graph: TGraphModel,
): Record<string, TEnrichmentState | undefined> =>
  Object.fromEntries(graph.nodes.map((node) => [node.id, node.data.enrichment]));

/** `enrichment` por nodo tal como lo pinta `GraphPane` (`data-nodes`). */
const domEnrichment = (): Record<string, TEnrichmentState | null> => {
  const raw = screen
    .getByTestId(TESTID.agentGraph)
    .getAttribute('data-nodes');

  const nodes =
    raw === null
      ? []
      : (JSON.parse(raw) as Array<{ id: string; enrichment: TEnrichmentState | null }>);

  return Object.fromEntries(nodes.map((node) => [node.id, node.enrichment]));
};

/** Último modelo entregado a la vista. */
const lastGraph = (): TGraphModel =>
  delivered.graphs[delivered.graphs.length - 1];

describe('frontera U6↔U3 — modelo enriquecido → GraphPane/InspectorPane (T029)', () => {
  beforeEach(() => {
    delivered.graphs.length = 0;
    resetServiceMock();
  });

  it('el modelo enriquecido llega a la vista con enrichment ready y las mismas aristas', async () => {
    const client = createIntegrationQueryClient();
    seedSessions(client, [buildSessionInfo()]);
    seedSubtree(client, [buildSessionInfo(), childSession()]);
    seedDevice(client, false);
    // Contenido del lote: la raíz trae un mensaje (métricas reales); el hijo, no.
    serviceMock.getSessionMessages.mockImplementation((id: string) =>
      Promise.resolve(id === ROOT ? [assistantMessage()] : []),
    );

    await renderWorkspace(client);
    await screen.findByTestId(TESTID.agentGraph);

    // 1) Primer modelo entregado: estructura pura, sin enriquecer.
    const structural = delivered.graphs[0];
    expect(enrichmentById(structural)).toEqual({
      [ROOT]: 'pending',
      [CHILD]: 'pending',
    });

    // 2) `GraphPane` recibe el subárbol enriquecido al completarse el lote.
    await waitFor(() =>
      expect(domEnrichment()).toEqual({
        [ROOT]: 'ready',
        [CHILD]: 'ready',
      }),
    );

    // 3) `InspectorPane` inspecciona la raíz por defecto (sin selección) y ve el
    //    mismo modelo enriquecido.
    const inspector = (): HTMLElement =>
      screen.getByTestId(TESTID.inspectorPanel);
    expect(inspector()).toHaveAttribute('data-node', ROOT);
    await waitFor(() =>
      expect(inspector()).toHaveAttribute('data-enrichment', 'ready'),
    );

    // 4) `edges` idénticas: el enriquecimiento no reconstruye la topología (misma
    //    referencia que la estructura y mismo valor).
    const enriched = lastGraph();
    expect(enriched.edges).toBe(structural.edges);
    expect(enriched.edges).toEqual([
      { id: `${ROOT}->${CHILD}`, source: ROOT, target: CHILD, type: 'agent' },
    ]);

    // 5) El modelo entregado está enriquecido de verdad: la métrica sale del
    //    contenido que el lote escribió en la caché compartida.
    expect(requireNode(enriched, ROOT).data.metrics.cost).toBe(0.01);
  });

  it('un nodo sin mensajes conserva la referencia previa y no degrada el ready de los demás', async () => {
    const client = createIntegrationQueryClient();
    const child = childSession();
    seedSessions(client, [buildSessionInfo()]);
    seedSubtree(client, [buildSessionInfo(), child]);
    // La raíz ya está lista en caché (clave de mensajes escrita); el hijo no.
    seedMessages(client, { [ROOT]: [] });
    seedDevice(client, false);
    // La lectura de contenido del nodo sin mensajes falla: su lote no lo marca.
    serviceMock.getSessionMessages.mockImplementation((id: string) =>
      id === CHILD
        ? Promise.reject(new Error('sin mensajes'))
        : Promise.resolve([]),
    );

    await renderWorkspace(client);
    await screen.findByTestId(TESTID.agentGraph);
    await waitFor(() =>
      expect(domEnrichment()).toEqual({
        [ROOT]: 'ready',
        [CHILD]: 'pending',
      }),
    );

    // El lote fallido no tumba la vista: sigue el grafo y no hay esqueleto ni
    // estado de error.
    expect(screen.queryByTestId(TESTID.graphSkeleton)).toBeNull();

    // El nodo sin mensajes nunca se marcó `ready` (no hay ready→pending).
    expect(
      delivered.graphs.every(
        (graph) => enrichmentById(graph)[CHILD] !== 'ready',
      ),
    ).toBe(true);

    const settled = lastGraph();
    expect(requireNode(settled, ROOT).data.enrichment).toBe('ready');
    expect(requireNode(settled, CHILD).data.enrichment).toBe('pending');
    const childBefore = requireNode(settled, CHILD);

    // Recomputa el modelo cambiando la **topología observable** por la vía
    // fiable: se reescribe el resultado del subárbol con una raíz nueva (cambia
    // su `time.updated`), de modo que TanStack Query no colapse el refresco por
    // *structural sharing* —los datos difieren— y la reconstrucción del modelo
    // sea observable. Las sesiones del árbol y, en particular, el nodo sin
    // mensajes son los mismos objetos: debe conservar la referencia previa
    // (SC-006) y el `ready` del otro no puede degradarse a `pending`
    // (data-model §2.2).
    act(() => {
      seedSubtree(client, [
        buildSessionInfo({ time: { created: 1, updated: 7 } }),
        child,
      ]);
    });

    await waitFor(() =>
      expect(delivered.graphs.some((graph) => graph !== settled)).toBe(true),
    );

    const refreshed = delivered.graphs.slice(
      delivered.graphs.indexOf(settled) + 1,
    );
    expect(refreshed.length).toBeGreaterThan(0);
    for (const graph of refreshed) {
      expect(requireNode(graph, CHILD)).toBe(childBefore);
      expect(enrichmentById(graph)).toEqual({
        [ROOT]: 'ready',
        [CHILD]: 'pending',
      });
    }
  });
});
