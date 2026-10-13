import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@app/Domains/queryKeys';
import { assistantMessage } from '@app/Domains/Graph/lib/specs/fixtures';
import {
  formDetail,
  formInfo,
  permissionRequest,
} from '../../lib/specs/fixtures';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedSessions,
  seedSubtree,
  serviceMock,
  TESTID,
} from './harness';

/**
 * E2E de frontera U6↔U2/U4/U7 (T028) — **siembra → consumo**.
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido)
 * y la caché de contenido **vacía**: la fase estructural pinta el grafo y el
 * enriquecimiento (`useGraphEnrichment`, U6) deja correr un lote por turno de
 * idle. El lote llama al SDK (doble del arnés) y escribe las claves compartidas
 * `sessions.messages(id)`, `permissions.for(id)`, `sessions.forms(id)` (+
 * `FormDetail`), `sessions.log(id)` y `sessions.execution(id)`.
 *
 * Se comprueba que lo escrito llega a los consumidores reales:
 *
 *   - `useChatPending` (U2) ⇒ ítem de permiso (semilla `permissions.for`) e ítem
 *     de pregunta (estado `waiting-input` derivado del `FormDetail` pendiente +
 *     `sessions.forms`), observables en `ChatPanelMarker.data-pending`.
 *   - el grafo (U6) marca el nodo `enrichment: 'ready'` en `data-nodes`.
 *
 * Frontera del histórico (`useHistoryData` → `HistoryModalMarker`,
 * `data-question-count`): NO se ejerce aquí. Abrir el overlay desde el grafo
 * sigue entrando en un bucle de render **preexistente** y ajeno a esta unidad:
 * al pasar el nodo a `waiting-input` (hay `FormDetail` pendiente) `useSessionForms`
 * habilita `sessions.forms(id, 'questions')` y el `useEffect` de `useCachedForms`
 * (`useSessionAttention`) se re-ejecuta al filtrar ese mismo prefijo de clave en
 * cada `observerOptionsUpdated` ⇒ `sync()` ⇒ nuevo objeto ⇒ render ⇒
 * `observer.setOptions` (efecto de `useBaseQuery`) ⇒ notifica de nuevo
 * (React: "Maximum update depth exceeded"). Con `permissions.list()` reducido a
 * una sola suscripción (`useChatPending` ya no abre observador propio) el clic
 * **sigue** colgando, así que la causa del hallazgo no era el observador
 * duplicado. El cableado del histórico ya está cubierto, verde, por
 * `workspaceHistoryData.integration.spec.tsx` (T022).
 *
 * Caso negativo obligatorio (fallo de red): el lote rechaza y **no** escribe
 * caché ⇒ el nodo permanece `pending`, la bandeja no inventa ítem y el resto
 * (grafo, chat) sigue montado sin estado de error.
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
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

const SESSION_ID = INTEGRATION_SESSION_ID;
const FORM_ID = 'form_root';
const PERMISSION_ID = 'perm_root';

/** Nodo del grafo tal como lo expone `AgentGraphMarker` (`data-nodes`). */
interface TNodeProbe {
  id: string;
  enrichment: string | null;
}

const readNodes = (marker: HTMLElement): TNodeProbe[] =>
  JSON.parse(marker.getAttribute('data-nodes') ?? '[]') as TNodeProbe[];

const enrichmentOf = (marker: HTMLElement, id: string): string | null =>
  readNodes(marker).find((node) => node.id === id)?.enrichment ?? null;

/** Ítem de la bandeja tal como lo expone `ChatPanelMarker` (`data-pending`). */
interface TPendingProbe {
  kind: string;
  permission?: { id: string };
  question?: { id: string };
}

const readPending = (chat: HTMLElement): TPendingProbe[] =>
  JSON.parse(chat.getAttribute('data-pending') ?? '[]') as TPendingProbe[];

/** Activa la pestaña `Chat` del detalle (escritorio) para montar la bandeja. */
const openChatTab = async (): Promise<HTMLElement> => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), {
    button: 0,
  });
  return screen.findByTestId(TESTID.chatPanel);
};

/** Estructura mínima + presentación: la raíz abierta en escritorio. */
const seedWorkspace = (client: QueryClient): void => {
  const root = buildSessionInfo();
  seedSessions(client, [root]);
  seedSubtree(client, [root]);
  seedDevice(client, false);
};

beforeEach(() => {
  resetServiceMock();
});

describe('integración U6↔U2/U4/U7 — siembra del enriquecimiento → consumo (T028)', () => {
  it('los lotes de idle escriben la caché y alimentan la bandeja', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client);

    const messages = [assistantMessage()];
    const permissions = [
      permissionRequest({ id: PERMISSION_ID, sessionID: SESSION_ID }),
    ];
    const forms = [formInfo({ id: FORM_ID, sessionID: SESSION_ID })];
    const detail = formDetail({ id: FORM_ID, sessionID: SESSION_ID });

    serviceMock.getSessionMessages.mockResolvedValue(messages);
    serviceMock.getSessionPermissions.mockResolvedValue(permissions);
    serviceMock.getSessionLog.mockResolvedValue([]);
    serviceMock.listSessionForms.mockResolvedValue(forms);
    serviceMock.getSessionForm.mockResolvedValue(detail);

    // Caché de contenido vacía antes del primer lote: todo lo que se afirme
    // después lo escribió el enriquecimiento.
    expect(
      client.getQueryData(queryKeys.sessions.messages(SESSION_ID)),
    ).toBeUndefined();
    expect(
      client.getQueryData(queryKeys.permissions.for(SESSION_ID)),
    ).toBeUndefined();
    expect(
      client.getQueryData(queryKeys.sessions.forms(SESSION_ID)),
    ).toBeUndefined();
    expect(
      client.getQueryData(queryKeys.sessions.execution(SESSION_ID)),
    ).toBeUndefined();

    await renderWorkspace(client);
    const graphMarker = await screen.findByTestId(TESTID.agentGraph);

    await flushIdle();

    // (1) El lote escribe las claves compartidas tal como las deja
    // `loadNodeContent` (mismo shape que parchea `eventReducer`).
    await waitFor(() =>
      expect(
        client.getQueryData(queryKeys.sessions.messages(SESSION_ID)),
      ).toEqual(messages),
    );
    expect(
      client.getQueryData(queryKeys.permissions.for(SESSION_ID)),
    ).toEqual(permissions);
    expect(client.getQueryData(queryKeys.sessions.forms(SESSION_ID))).toEqual(
      forms,
    );
    expect(
      client.getQueryData([
        ...queryKeys.sessions.forms(SESSION_ID),
        FORM_ID,
      ]),
    ).toEqual(detail);
    await waitFor(() =>
      expect(
        client.getQueryData<Record<string, unknown>>(
          queryKeys.sessions.execution(SESSION_ID),
        ),
      ).toHaveProperty(SESSION_ID),
    );

    // (2) Consumidor del grafo: los mensajes en caché marcan el nodo `ready`.
    await waitFor(() =>
      expect(enrichmentOf(graphMarker, SESSION_ID)).toBe('ready'),
    );

    // (3) Consumidor de la bandeja (`useChatPending`): el permiso de
    // `permissions.for(id)` y la pregunta derivada de `sessions.forms(id)` (el
    // `FormDetail` pendiente deja el nodo en `waiting-input`).
    const chat = await openChatTab();
    await waitFor(() => expect(readPending(chat)).toHaveLength(2));
    const pending = readPending(chat);
    expect(pending.map((item) => item.kind).sort()).toEqual([
      'permission',
      'question',
    ]);
    expect(
      pending.find((item) => item.kind === 'permission')?.permission?.id,
    ).toBe(PERMISSION_ID);
    expect(
      pending.find((item) => item.kind === 'question')?.question?.id,
    ).toBe(FORM_ID);
  });
  it('un lote que falla no escribe caché: el nodo sigue pending y la bandeja no inventa ítem', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client);

    // Fallo de red: `loadNodeContent` rechaza antes de escribir ninguna clave y
    // el hook deja el lote sin progreso (contrato de carga §3).
    serviceMock.getSessionMessages.mockRejectedValue(new Error('fallo de red'));
    serviceMock.getSessionPermissions.mockResolvedValue([
      permissionRequest({ id: PERMISSION_ID, sessionID: SESSION_ID }),
    ]);
    serviceMock.listSessionForms.mockResolvedValue([
      formInfo({ id: FORM_ID, sessionID: SESSION_ID }),
    ]);
    serviceMock.getSessionForm.mockResolvedValue(
      formDetail({ id: FORM_ID, sessionID: SESSION_ID }),
    );

    await renderWorkspace(client);
    const graphMarker = await screen.findByTestId(TESTID.agentGraph);

    await flushIdle();
    await waitFor(() =>
      expect(serviceMock.getSessionMessages).toHaveBeenCalledWith(SESSION_ID),
    );

    // Ninguna clave del lote se escribió.
    expect(
      client.getQueryData(queryKeys.sessions.messages(SESSION_ID)),
    ).toBeUndefined();
    expect(
      client.getQueryData(queryKeys.permissions.for(SESSION_ID)),
    ).toBeUndefined();
    expect(
      client.getQueryData(queryKeys.sessions.forms(SESSION_ID)),
    ).toBeUndefined();
    expect(
      client.getQueryData(queryKeys.sessions.execution(SESSION_ID)),
    ).toBeUndefined();

    // El nodo permanece `pending`: no se degrada ni finge estar listo.
    expect(enrichmentOf(graphMarker, SESSION_ID)).toBe('pending');

    // La bandeja no inventa ítem a partir de un lote que no escribió caché.
    const chat = await openChatTab();
    expect(readPending(chat)).toEqual([]);

    // El resto no se bloquea: el grafo y el chat siguen en datos, sin error.
    expect(screen.getByTestId(TESTID.agentGraph)).toBeInTheDocument();
    expect(screen.getByTestId(TESTID.chatPanel)).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });
});
