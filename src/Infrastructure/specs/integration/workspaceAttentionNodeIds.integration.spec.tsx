import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { useSessionAttention } from '@app/Domains/Chat/Hooks/useSessionAttention';
import { attentionItem, permissionRequest } from '../../lib/specs/fixtures';
import {
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_SESSION_ID,
  TESTID,
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedPermissions,
  seedSessions,
  seedSubtree,
} from './harness';

/**
 * E2E frontera U2↔U6 — realce por nodo (T019, FR-009/FR-016).
 *
 * Monta `WorkspacePage` con el **modelo y los hooks reales** (arnés compartido)
 * para ejercer la cadena completa de estado:
 *
 *   `useSessionAttention` (U4, entrada `graph.graph`) → `useAttentionNodeIds`
 *   (U2) → `GraphPane.attentionNodeIds` → nodo del grafo (U6).
 *
 * El grafo se sustituye por el marcador del arnés (`AgentGraphMarker`), que
 * expone el `Set` recibido en `data-attention` y los ids/enriquecimiento de los
 * nodos en `data-nodes`, de modo que el realce se afirma sobre el **cableado
 * real** y no sobre un doble.
 *
 * Caso negativo obligatorio: un ítem de atención con `nodeId === null` (pendiente
 * de una sesión fuera del subárbol) ⇒ `useAttentionNodeIds` produce el conjunto
 * vacío, **ningún** nodo se realza y el grafo no se re-layouta (sigue montado con
 * sus mismos nodos). Para inyectar ese ítem se sustituye **solo** la frontera de
 * U4 (`useSessionAttention`); el camino feliz la llama a través
 * (`mockImplementation` con la implementación real).
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

vi.mock('@app/Domains/Chat/Hooks/useSessionAttention', () => ({
  useSessionAttention: vi.fn(),
}));

/** Implementación **real** de la frontera U4, para el camino feliz. */
const loadActualUseSessionAttention = () =>
  vi.importActual<typeof import('@app/Domains/Chat/Hooks/useSessionAttention')>(
    '@app/Domains/Chat/Hooks/useSessionAttention',
  );

const nodeIdsOf = (marker: HTMLElement): string[] =>
  (
    JSON.parse(marker.getAttribute('data-nodes') ?? '[]') as Array<{
      id: string;
    }>
  )
    .map((node) => node.id)
    .sort();

describe('integración U2↔U6 — realce por nodo de atención (T019)', () => {
  beforeEach(() => {
    resetServiceMock();
    vi.mocked(useSessionAttention).mockReset();
  });

  it('realza el nodo del subárbol con un permiso pendiente (U4→U2→U6)', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: INTEGRATION_CHILD_SESSION_ID,
      parentID: INTEGRATION_SESSION_ID,
    });
    seedSessions(client, [root]);
    seedSubtree(client, [root, child]);
    seedDevice(client, false);

    // Permiso abierto de la **hija**: marca su nodo `waiting-permission`
    // (enriquecimiento lee `permissions.for(id)`) y alimenta la lista global que
    // consume `useSessionAttention`.
    const permission = permissionRequest({
      id: 'perm_child',
      sessionID: INTEGRATION_CHILD_SESSION_ID,
    });
    seedPermissions(client, [permission], {
      bySession: { [INTEGRATION_CHILD_SESSION_ID]: [permission] },
    });
    // La hija ya está en caché: su nodo se enriquece y queda definitivo.
    seedMessages(client, { [INTEGRATION_CHILD_SESSION_ID]: [] });

    vi.mocked(useSessionAttention).mockImplementation(
      (await loadActualUseSessionAttention()).useSessionAttention,
    );

    await renderWorkspace(client);
    await flushIdle();

    const graphMarker = await screen.findByTestId(TESTID.agentGraph);

    // El `Set` derivado de `useAttentionNodeIds` llega hasta el nodo del grafo.
    await waitFor(() =>
      expect(graphMarker).toHaveAttribute(
        'data-attention',
        INTEGRATION_CHILD_SESSION_ID,
      ),
    );

    // Realza el nodo afectado y solo él: la raíz no está en el conjunto.
    expect(graphMarker.getAttribute('data-attention')).not.toContain(
      INTEGRATION_SESSION_ID,
    );
    // El grafo conserva sus dos nodos (topología intacta).
    expect(nodeIdsOf(graphMarker)).toEqual(
      [INTEGRATION_CHILD_SESSION_ID, INTEGRATION_SESSION_ID].sort(),
    );
  });

  it('un ítem con nodeId === null no realza nada ni re-layouta el grafo', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: INTEGRATION_CHILD_SESSION_ID,
      parentID: INTEGRATION_SESSION_ID,
    });
    seedSessions(client, [root]);
    seedSubtree(client, [root, child]);
    seedDevice(client, false);

    // Frontera U4 sustituida: ítem de un pendiente sin nodo en el subárbol.
    vi.mocked(useSessionAttention).mockReturnValue([
      attentionItem({
        id: 'perm_outside',
        sessionId: 'ses_outside',
        nodeId: null,
      }),
    ]);

    await renderWorkspace(client);
    await flushIdle();

    const graphMarker = await screen.findByTestId(TESTID.agentGraph);

    // `useAttentionNodeIds` descarta el ítem ⇒ conjunto vacío.
    expect(graphMarker).toHaveAttribute('data-attention', '');
    // Ningún nodo realzado y sin re-layout: el grafo sigue con sus dos nodos.
    expect(nodeIdsOf(graphMarker)).toEqual(
      [INTEGRATION_CHILD_SESSION_ID, INTEGRATION_SESSION_ID].sort(),
    );
  });
});
