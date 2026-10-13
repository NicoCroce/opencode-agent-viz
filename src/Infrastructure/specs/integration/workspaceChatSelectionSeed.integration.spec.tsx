/**
 * E2E de frontera U2↔U4 (T020) — **semilla de selección del chat**.
 *
 * Recorre con el modelo y los hooks **reales** la cadena
 * `useChatSelectionSeed` → `ChatPanel.selectionSeed` → `useChatController`,
 * montando `WorkspacePage` con el arnés compartido (`./harness`). El
 * `ChatPanel` se sustituye por el marcador del arnés, que expone la semilla
 * recibida en `data-selection`; la página y la semilla (`useChatSelectionSeed`)
 * son reales, así que se ejerce la frontera de verdad.
 *
 * Casos:
 * 1. **Camino feliz**: la sesión abierta tiene su nodo en el grafo ⇒ la semilla
 *    lleva el agente y el modelo vigentes del nodo, de modo que `useChatController`
 *    aplica los `switch*` al arrancar (FR-008).
 * 2. **Negativo (404 / sesión sin nodo en el grafo)**: la sesión abierta no está
 *    entre los nodos ⇒ `{ agent: null, model: null }`, que significa "no cambiar":
 *    `useChatController` **no** reaplica los `switch*` (FR-008).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AgentInfo, ModelRef } from '@opencode/client';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

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

/** Modelo de referencia del catálogo de agentes (semilla determinista). */
const MODEL: ModelRef = { id: 'claude-sonnet-4', providerID: 'anthropic' };

const buildAgent = (
  id: string,
  overrides: Partial<AgentInfo> = {},
): AgentInfo =>
  ({ id, name: id, model: MODEL, ...overrides }) as unknown as AgentInfo;

/** Semilla tal como la recibe el marcador (`data-selection`). */
const readSelection = (element: HTMLElement): unknown =>
  JSON.parse(element.getAttribute('data-selection') ?? '{}');

/** Espera a que la fase estructural pinte el grafo con los nodos dados. */
const waitForGraphNodes = async (sessionId: string): Promise<void> => {
  await waitFor(() =>
    expect(screen.getByTestId(TESTID.agentGraph)).toHaveAttribute(
      'data-nodes',
      expect.stringContaining(sessionId),
    ),
  );
};

/** Activa la pestaña `Chat` del detalle (escritorio) para montar el panel. */
const openChatTab = async (): Promise<HTMLElement> => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), {
    button: 0,
  });
  return screen.findByTestId(TESTID.chatPanel);
};

beforeEach(() => {
  resetServiceMock();
});

describe('Workspace — semilla de selección del chat (T020, frontera U2↔U4)', () => {
  it('sesión con nodo en el grafo: siembra agente y modelo del nodo (switch*)', async () => {
    const session = buildSessionInfo({ agent: 'develop' });
    const client = createIntegrationQueryClient();
    seedDevice(client, false);
    seedSessions(client, [session], { agents: [buildAgent('develop')] });
    seedSubtree(client, [session]);

    await renderWorkspace(client);
    await waitForGraphNodes(INTEGRATION_SESSION_ID);

    const chat = await openChatTab();

    expect(chat).toHaveAttribute('data-session-id', INTEGRATION_SESSION_ID);
    expect(readSelection(chat)).toEqual({ agent: 'develop', model: MODEL });
  });

  it('sesión sin nodo en el grafo (404): la semilla es null/null = "no cambiar"', async () => {
    // La sesión abierta existe en el rail (el `directory` resuelve) pero **no**
    // está entre los nodos del grafo: el dato del nodo es inexistente (404), así
    // que la semilla cae a `{ agent: null, model: null }` y `useChatController`
    // no reaplica los `switch*`.
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: INTEGRATION_CHILD_SESSION_ID,
      parentID: INTEGRATION_SESSION_ID,
      agent: 'explore',
    });
    const client = createIntegrationQueryClient();
    seedDevice(client, false);
    seedSessions(client, [root], {
      agents: [buildAgent('develop'), buildAgent('explore')],
    });
    // El subárbol trae solo la hija: el nodo de la sesión abierta no existe.
    seedSubtree(client, [child]);

    await renderWorkspace(client);
    await waitForGraphNodes(INTEGRATION_CHILD_SESSION_ID);

    const chat = await openChatTab();

    expect(chat).toHaveAttribute('data-session-id', INTEGRATION_SESSION_ID);
    expect(readSelection(chat)).toEqual({ agent: null, model: null });
  });
});
