import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { formDetail, formInfo } from '../../lib/specs/fixtures';
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
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * T006 (013) — regresión E2E del cuelgue al abrir el histórico de un nodo
 * `waiting-input` (FR-006/US4, research R4).
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido,
 * sin editar) y la caché sembrada:
 *
 *   - un nodo `waiting-input` (`sessions.forms(id)` + `FormDetail` `pending`),
 *     que hace que `useSessionAttention` (U4) derive un ítem de pregunta y
 *     active su suscripción a `sessions.forms(id)`;
 *   - sus preguntas resueltas (`sessions.questions(id)`, `useSessionForms`) para
 *     que el histórico tenga contenido (`data-question-count >= 1`).
 *
 * Al abrir el histórico (`fireEvent.click` sobre `Abrir histórico` del
 * `AgentGraphMarker`), `useSessionForms` registra un observador sobre
 * `sessions.questions(id)` —clave **anidada** bajo `sessions.forms(id)`— y su
 * `observerOptionsUpdated` casa el filtro por prefijo de `useCachedForms`:
 * `sync()` → objeto nuevo → render → `observer.setOptions` → notifica de nuevo.
 * El bucle de render es **síncrono**, así que el `timeout` del `it` no alcanza a
 * cortarlo y la prueba no termina: ese es el rojo esperado de hoy (US4). Tras
 * T007–T009 (filtro por clave exacta + identidad estable + solo eventos de dato)
 * el histórico abre y la prueba pasa, sin cambiar el producto desde aquí.
 *
 * Caso negativo (Principio VIII): sin `sessions.questions(id)` ni
 * `sessions.forms(id)` cacheados el histórico abre igual, sin cuelgue, y expone
 * `data-question-count = 0` (no inventa preguntas).
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

/** Sesión abierta y primer (único) nodo del subárbol sembrado. */
const SESSION_ID = INTEGRATION_SESSION_ID;
/** Formulario `pending` que deja el nodo en `waiting-input`. */
const FORM_ID = 'form_waiting_input';

/** Pregunta pendiente tal como la consume el histórico (`TQuestionEntry`). */
const pendingQuestion = (): TQuestionEntry => ({
  id: FORM_ID,
  title: '¿Aplicar el cambio?',
  fields: [
    {
      key: 'reason',
      title: 'Motivo',
      type: 'string',
      options: [{ value: 'ok', label: 'Correcto' }],
    },
  ],
  state: 'pending',
  answer: null,
});

/** Estructura mínima + presentación: la raíz abierta en escritorio. */
const seedWorkspace = (client: QueryClient): void => {
  const root = buildSessionInfo();
  seedSessions(client, [root]);
  seedSubtree(client, [root]);
  seedDevice(client, false);
};

/**
 * Siembra el nodo `waiting-input`: la lista cruda (`bySession`), el `FormDetail`
 * `pending` que marca la espera (grafo/atención) y las preguntas que consume el
 * histórico (`questions`).
 *
 * Los mensajes vacíos son obligatorios: marcan el nodo como listo para
 * `useGraphEnrichment` (`collectReadyIds` mira `sessions.messages(id)`) y evitan
 * que el lote de idle llame a `loadNodeContent`, que **pisaría** los formularios
 * sembrados con la lista vacía del SDK.
 */
const seedWaitingInputNode = (client: QueryClient): void => {
  seedMessages(client, { [SESSION_ID]: [] });
  seedForms(client, {
    bySession: {
      [SESSION_ID]: [formInfo({ id: FORM_ID, sessionID: SESSION_ID })],
    },
    details: {
      [SESSION_ID]: [formDetail({ id: FORM_ID, sessionID: SESSION_ID })],
    },
    questions: { [SESSION_ID]: [pendingQuestion()] },
  });
};

/** Monta la página y espera al grafo (primer nodo = la raíz abierta). */
const renderWorkspaceWithGraph = async (client: QueryClient): Promise<void> => {
  await renderWorkspace(client);
  await screen.findByTestId(TESTID.agentGraph);
  await flushIdle();
};

/** Abre el histórico del primer nodo desde el control del propio grafo. */
const openFirstNodeHistory = async (): Promise<HTMLElement> => {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir histórico' }));
  return screen.findByTestId(TESTID.historyModal);
};

describe('T006 — abrir el histórico de un nodo waiting-input (U2↔U7/U8, FR-006)', () => {
  beforeEach(() => {
    resetServiceMock();
  });

  it(
    'abre el histórico de la sesión en espera sin colgar la interfaz y con sus preguntas pendientes',
    async () => {
      const client = createIntegrationQueryClient();
      seedWorkspace(client);
      seedWaitingInputNode(client);

      await renderWorkspaceWithGraph(client);

      const modal = await openFirstNodeHistory();

      // El histórico de la sesión del nodo abierto, con sus preguntas abiertas.
      expect(modal).toHaveAttribute('data-node', SESSION_ID);
      expect(
        Number(modal.getAttribute('data-question-count')),
      ).toBeGreaterThanOrEqual(1);
    },
    { timeout: 15_000 },
  );

  it(
    'sin preguntas ni formularios cacheados abre igual, sin cuelgue y con data-question-count = 0',
    async () => {
      const client = createIntegrationQueryClient();
      seedWorkspace(client);
      // Sin `sessions.forms(id)` ni `sessions.questions(id)`: nada que derive la
      // espera ni alimente el histórico.

      await renderWorkspaceWithGraph(client);

      const modal = await openFirstNodeHistory();

      expect(modal).toHaveAttribute('data-node', SESSION_ID);
      expect(modal).toHaveAttribute('data-question-count', '0');
    },
    { timeout: 15_000 },
  );
});
