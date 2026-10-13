import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { SessionMessageInfo } from '@opencode/client';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { queryKeys } from '@app/Domains/queryKeys';
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
  seedForms,
  seedQueryData,
  seedSessions,
  seedSubtree,
  serviceMock,
} from './harness';

/**
 * T022 (012) — E2E de frontera U2↔U7/U8: datos del histórico.
 *
 * Verifica el cableado **completo** `useHistoryData` → `HistoryOverlay` sobre la
 * página real (`WorkspacePage`): el nodo y el linaje derivados del grafo
 * (`useHistoryOverlay`) más las preguntas (`useSessionForms`) y el contexto de
 * compactación (`useSessionContext`) de la sesión del nodo abierto.
 *
 * El overlay se abre desde el grafo (único control disponible con los marcadores
 * del arnés) y el `HistoryModal` se sustituye por el marcador de
 * `mockHistoryBarrel`, que expone `node` (`data-node`), `lineage`
 * (`data-parent`/`data-children`), `questions` (`data-question-count`) y monta el
 * contexto de compactación que le entrega el overlay.
 *
 * Caso negativo (equivalente al 404 de la sesión): el objetivo desaparece del
 * grafo (`targetId` sin nodo) ⇒ `missingId` marca el estado "Histórico no
 * disponible" sin `questions` ni `context`, y `clearMissing` (botón `Cerrar`) lo
 * limpia.
 *
 * El SDK y los barrels pesados se doblan con el **arnés compartido**
 * (`./harness.tsx`, T003): aquí no se reimplementa ni se edita.
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: sdk } = await import('./harness');
  return { opencodeService: sdk };
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

/** Raíz del subárbol sembrado (también la sesión de la ruta). */
const ROOT_SESSION_ID = INTEGRATION_SESSION_ID;
/** Hija de la raíz: única arista del linaje del histórico. */
const CHILD_SESSION_ID = INTEGRATION_CHILD_SESSION_ID;

const rootSession = () => buildSessionInfo({ id: ROOT_SESSION_ID });

const childSession = () =>
  buildSessionInfo({
    id: CHILD_SESSION_ID,
    parentID: ROOT_SESSION_ID,
    agent: 'explore',
    title: 'subagente',
    time: { created: 3, updated: 4 },
  });

/** Pregunta resuelta tal como la cachea `useSessionForms` (`TQuestionEntry`). */
const historyQuestion = (): TQuestionEntry => ({
  id: 'form-1',
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

/** Mensaje del contexto resultante de la compactación (`session.context`). */
const contextMessage = (): SessionMessageInfo => ({
  id: 'msg-ctx',
  time: { created: 5 },
  type: 'user',
  text: 'resumen de la compactación',
});

/** Monta la página con el subárbol raíz→hija sembrado y la presentación desktop. */
const renderHistoryScenario = async ({
  questions = {},
  context,
}: {
  questions?: Record<string, TQuestionEntry[]>;
  context?: SessionMessageInfo[];
} = {}) => {
  const client = createIntegrationQueryClient();
  seedSessions(client, [rootSession(), childSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedDevice(client, false);
  seedForms(client, { questions });
  if (context) {
    seedQueryData(client, queryKeys.sessions.context(ROOT_SESSION_ID), context);
  }

  await renderWorkspace(client);
  // El primer nodo del grafo es la primera sesión del subárbol: la raíz.
  await screen.findByTestId(TESTID.agentGraph);
  await flushIdle();

  return client;
};

/** Abre el histórico del primer nodo del grafo desde el marcador del grafo. */
const openFirstNodeHistory = async () => {
  fireEvent.click(
    screen.getByRole('button', { name: 'Abrir histórico' }),
  );
  return screen.findByTestId(TESTID.historyModal);
};

describe('T022 — datos del histórico (U2↔U7/U8)', () => {
  beforeEach(() => {
    resetServiceMock();
  });

  it('lleva nodo, linaje, preguntas y contexto de la sesión abierta hasta el overlay', async () => {
    await renderHistoryScenario({
      questions: { [ROOT_SESSION_ID]: [historyQuestion()] },
      context: [contextMessage()],
    });

    const modal = await openFirstNodeHistory();

    // Nodo y linaje derivados del grafo (raíz sin padre + su hija).
    expect(modal).toHaveAttribute('data-node', ROOT_SESSION_ID);
    expect(modal).toHaveAttribute('data-enrichment', 'ready');
    expect(modal).toHaveAttribute('data-parent', '');
    expect(modal).toHaveAttribute('data-children', CHILD_SESSION_ID);

    // Preguntas de la sesión del nodo (no de la página).
    expect(modal).toHaveAttribute('data-question-count', '1');

    // Contexto de compactación de esa misma sesión, montado por el overlay.
    expect(screen.getByTestId('compaction-context')).toBeInTheDocument();
    expect(
      screen.getByText('resumen de la compactación'),
    ).toBeInTheDocument();

    // Con el objetivo presente no se marca el estado "no disponible".
    expect(
      screen.queryByRole('dialog', { name: 'Histórico no disponible' }),
    ).toBeNull();
  });

  it('marca missingId cuando el objetivo desaparece del grafo y clearMissing lo limpia', async () => {
    const client = await renderHistoryScenario();

    const modal = await openFirstNodeHistory();
    expect(modal).toHaveAttribute('data-node', ROOT_SESSION_ID);

    // El objetivo desaparece del grafo (equivale al 404 de la sesión: el
    // `targetId` abierto ya no resuelve nodo).
    act(() => {
      seedSubtree(client, [childSession()]);
    });

    await waitFor(() =>
      expect(screen.queryByTestId(TESTID.historyModal)).toBeNull(),
    );

    // Estado "no disponible" marcado por `missingId`: sin el modal no hay
    // `questions` ni `context` del objetivo perdido (el overlay no los rinde).
    const unavailable = screen.getByRole('dialog', {
      name: 'Histórico no disponible',
    });
    expect(unavailable).toBeInTheDocument();
    expect(
      screen.getByText('El agente ya no está en el grafo.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('compaction-context')).toBeNull();
    expect(screen.queryByText('resumen de la compactación')).toBeNull();

    // El hook deja de consultar los datos del objetivo inexistente.
    const formsCalls = serviceMock.listSessionForms.mock.calls.length;
    const contextCalls = serviceMock.getSessionContext.mock.calls.length;
    await flushIdle();
    expect(serviceMock.listSessionForms.mock.calls.length).toBe(formsCalls);
    expect(serviceMock.getSessionContext.mock.calls.length).toBe(contextCalls);

    // `clearMissing` (acción del estado vacío) limpia el aviso.
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Histórico no disponible' }),
      ).toBeNull(),
    );
  });
});
