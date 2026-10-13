import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
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
  seedForms,
  seedMessages,
  seedPermissions,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * E2E frontera U2↔U4 (T017) — bandeja de pendientes del chat.
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido)
 * y la **caché sembrada** (no hay lote de red que escriba por nosotros): la
 * bandeja la compone `useChatPending` (U2) a partir de la atención derivada por
 * `useSessionAttention` (U4) y de la caché `permissions.list()` /
 * `permissions.for(id)` / `sessions.forms(id)` (+ `FormDetail`).
 *
 * El nodo del grafo se expone con el marcador del arnés (`AgentGraphMarker`) y
 * la bandeja con el contrato `data-pending` del `ChatPanelMarker` (el
 * `chat-pending-tray` real vive en el `ChatPanel`; con `mockChatBarrel` solo se
 * puede afirmar el contrato que `WorkspacePage` cablea). Todo el camino va por
 * el **cableado real** `WorkspacePage → useChatPending`; no se sustituye ningún
 * hook.
 *
 * Caso negativo obligatorio: un `FormDetail` con `state !== 'pending'`, un
 * permiso de una sesión **fuera** del subárbol en `permissions.list()` y claves
 * `permissions.for`/`sessions.forms` ausentes ⇒ la bandeja queda vacía, sin
 * inventar ítems ni mostrar estado de error.
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

const ROOT_ID = INTEGRATION_SESSION_ID;
const PERMISSION_CHILD_ID = 'ses_perm_child';
const QUESTION_CHILD_ID = 'ses_question_child';
const OUTSIDE_SESSION_ID = 'ses_outside';

const PERMISSION_ID = 'perm_child';
const PERMISSION_ACTION = 'write';
const FORM_ID = 'form_child';

/** Ítem de la bandeja tal como lo expone `ChatPanelMarker` (`data-pending`). */
interface TPendingProbe {
  kind: string;
  originSessionId: string;
  permission?: { id: string; action: string };
  question?: { id: string; state: string };
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

/** Estructura mínima compartida: raíz abierta + dos hijas, en escritorio. */
const seedWorkspaceWithChildren = (client: QueryClient): void => {
  seedSessions(client, [buildSessionInfo()]);
  seedSubtree(client, [
    buildSessionInfo(),
    buildSessionInfo({
      id: PERMISSION_CHILD_ID,
      parentID: ROOT_ID,
      agent: 'perm-agent',
    }),
    buildSessionInfo({
      id: QUESTION_CHILD_ID,
      parentID: ROOT_ID,
      agent: 'question-agent',
    }),
  ]);
  seedDevice(client, false);
};

beforeEach(() => {
  resetServiceMock();
});

describe('integración U2↔U4 — bandeja de pendientes del subárbol (T017)', () => {
  it('compone el permiso y la pregunta de las sesiones hijas con su origen y acción', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspaceWithChildren(client);

    // La hija con permiso ya está en caché ⇒ su nodo se enriquece y queda
    // `waiting-permission` (lee `permissions.for(id)`); el permiso también está
    // en la lista global, fuente de la atención (U4) y de la bandeja (U2).
    const permission = permissionRequest({
      id: PERMISSION_ID,
      sessionID: PERMISSION_CHILD_ID,
      action: PERMISSION_ACTION,
    });
    seedPermissions(client, [permission], {
      bySession: { [PERMISSION_CHILD_ID]: [permission] },
    });
    seedMessages(client, {
      [PERMISSION_CHILD_ID]: [],
      [QUESTION_CHILD_ID]: [],
    });

    // La hija con pregunta queda `waiting-input` porque su `FormDetail` está
    // `pending`; su permiso está ausente, así que la espera es de formulario.
    seedForms(client, {
      bySession: {
        [QUESTION_CHILD_ID]: [
          formInfo({ id: FORM_ID, sessionID: QUESTION_CHILD_ID }),
        ],
      },
      details: {
        [QUESTION_CHILD_ID]: [
          formDetail({ id: FORM_ID, sessionID: QUESTION_CHILD_ID }),
        ],
      },
    });

    await renderWorkspace(client);
    await screen.findByTestId(TESTID.agentGraph);
    await flushIdle();

    const chat = await openChatTab();
    await waitFor(() => expect(readPending(chat)).toHaveLength(2));

    const pending = readPending(chat);
    expect(pending.map((item) => item.kind).sort()).toEqual([
      'permission',
      'question',
    ]);

    // Permiso de la hija: el origen es su sesión y la acción la del permiso.
    const permissionItem = pending.find((item) => item.kind === 'permission');
    expect(permissionItem?.originSessionId).toBe(PERMISSION_CHILD_ID);
    expect(permissionItem?.permission).toMatchObject({
      id: PERMISSION_ID,
      action: PERMISSION_ACTION,
    });

    // Pregunta de la hija: el origen es su sesión y sigue `pending`.
    const questionItem = pending.find((item) => item.kind === 'question');
    expect(questionItem?.originSessionId).toBe(QUESTION_CHILD_ID);
    expect(questionItem?.question).toMatchObject({
      id: FORM_ID,
      state: 'pending',
    });

    // El resto del workspace sigue sano (sin estado de error).
    expect(screen.getByTestId(TESTID.agentGraph)).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('no inventa ítems con un formulario resuelto, un permiso fuera del subárbol y claves ausentes', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspaceWithChildren(client);

    // Permiso de una sesión **fuera** del subárbol: ni la atención ni la
    // bandeja lo aceptan (el filtro es por `sessionID` del subárbol).
    seedPermissions(client, [
      permissionRequest({ id: 'perm_outside', sessionID: OUTSIDE_SESSION_ID }),
    ]);

    // `FormDetail` resuelto (`answered`): la hija deja de estar `waiting-input`
    // y la pregunta resuelta no vuelve a la bandeja.
    seedForms(client, {
      bySession: {
        [QUESTION_CHILD_ID]: [
          formInfo({ id: FORM_ID, sessionID: QUESTION_CHILD_ID }),
        ],
      },
      details: {
        [QUESTION_CHILD_ID]: [
          formDetail({
            id: FORM_ID,
            sessionID: QUESTION_CHILD_ID,
            state: { status: 'answered', answer: { reason: 'ok' } },
          }),
        ],
      },
    });
    // Las hijas están en caché para que la siembra no la sobrescriba el lote.
    seedMessages(client, {
      [PERMISSION_CHILD_ID]: [],
      [QUESTION_CHILD_ID]: [],
    });
    // Claves `permissions.for` ausentes: nadie está en `waiting-permission`.

    await renderWorkspace(client);
    await screen.findByTestId(TESTID.agentGraph);
    await flushIdle();

    const chat = await openChatTab();
    expect(readPending(chat)).toEqual([]);

    // Sin error y con el grafo/chat montados.
    expect(screen.getByTestId(TESTID.agentGraph)).toBeInTheDocument();
    expect(screen.getByTestId(TESTID.chatPanel)).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });
});
