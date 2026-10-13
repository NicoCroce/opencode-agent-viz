import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import type { Project } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import { countAttentionByRoot } from '@app/Infrastructure/lib/countAttentionByRoot';
import {
  formDetail,
  formInfo,
  permissionRequest,
} from '../../lib/specs/fixtures';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedForms,
  seedMessages,
  seedPermissions,
  seedQueryData,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * T014 [US3] — E2E de frontera **U4↔U5**: badge de atención por raíz del rail.
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido,
 * sin editar) y la caché sembrada, y recorre la cadena
 * `useSessionAttention` (U4) → `openQuestionCount` → `useAttentionByRoot`/
 * `countAttentionByRoot` (U5) → `SessionsRail` → `SessionList` del arnés, que
 * expone el mapa por raíz en `data-attention`.
 *
 * Se afirma:
 *
 *   1. El conteo por raíz refleja el índice de U4 con los conteos/etiquetas de
 *      hoy: la raíz abierta suma los permisos de su subárbol **más** la pregunta
 *      derivada de su nodo `waiting-input`; el resto de raíces cuenta solo su
 *      propia sesión; la sesión fuera del subárbol no entra en ningún conteo. Las
 *      etiquetas (id/título del ítem de pregunta, acción del permiso) se
 *      comprueban sobre la misma lista derivada, en el `ChatPanelMarker`.
 *   2. Una **notificación sin cambio de dato** (evento estructural
 *      `observerOptionsUpdated`/`observerResultsUpdated`, la tormenta que emitía
 *      el observador de `sessions.questions(id)` en cada render) **no recalcula**
 *      el conteo: `countAttentionByRoot` conserva su última identidad (R2/R3).
 *   3. Caso negativo no vacuo: un cambio **de dato** sí recalcula y mueve el
 *      badge (si no, la aserción 2 pasaría por inercia).
 *
 * Caso negativo (Principio VIII): una sesión **fuera del subárbol** no recibe
 * entrada y un nodo con `FormDetail` pendiente pero **sin** `sessions.forms(id)`
 * no produce pregunta ⇒ el conteo de la raíz abierta queda en `0`.
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

/**
 * Sonda del conteo por raíz (U5): conserva la implementación real y solo cuenta
 * cuántas veces `useAttentionByRoot` la recalcula, para poder afirmar que una
 * notificación estructural no invalida el memo (identidad estable).
 */
vi.mock('@app/Infrastructure/lib/countAttentionByRoot', async () => {
  const actual = await vi.importActual<
    typeof import('@app/Infrastructure/lib/countAttentionByRoot')
  >('@app/Infrastructure/lib/countAttentionByRoot');
  return { countAttentionByRoot: vi.fn(actual.countAttentionByRoot) };
});

const ROOT_ID = INTEGRATION_SESSION_ID; // 'ses_root' — raíz abierta
const CHILD_ID = INTEGRATION_CHILD_SESSION_ID; // 'ses_child' — hija en waiting-input
const OTHER_ROOT_ID = 'ses_other'; // otra raíz con un permiso propio
const QUIET_ROOT_ID = 'ses_quiet'; // raíz sin pendientes
const OUTSIDE_SESSION_ID = 'ses_outside'; // pendiente fuera del subárbol abierto

const PERM_ROOT_ID = 'perm_root';
const PERM_OUTSIDE_ID = 'perm_outside';
const PERM_ACTION = 'write';
const FORM_ID = 'form_child';
const FORM_TITLE = '¿Aplicar el cambio?';

const rootSession = () => buildSessionInfo();
const childSession = () =>
  buildSessionInfo({ id: CHILD_ID, parentID: ROOT_ID });
const otherRootSession = () => buildSessionInfo({ id: OTHER_ROOT_ID });
const quietRootSession = () => buildSessionInfo({ id: QUIET_ROOT_ID });

const project = (canonical: string): Project => ({
  id: canonical,
  canonical,
  time: { created: 1, updated: 1, active: 1 },
  sandboxes: [],
});

/**
 * Siembra el escenario completo: proyectos (dirigen `sessions.roots`), las tres
 * raíces del rail, el subárbol de la raíz abierta (raíz + hija), los mensajes
 * cacheados (para que el enriquecimiento marque los nodos sin red), el permiso
 * propio de la raíz, un permiso de una sesión **fuera** del subárbol y el
 * formulario pendiente de la hija (⇒ nodo `waiting-input` ⇒ pregunta).
 */
const seedSubtreeWithPendings = (client: QueryClient): void => {
  const rootPermission = permissionRequest({
    id: PERM_ROOT_ID,
    sessionID: ROOT_ID,
    action: PERM_ACTION,
  });

  seedQueryData(client, queryKeys.projects.list(), [
    project(INTEGRATION_DIRECTORY),
  ]);
  seedSessions(client, [rootSession(), otherRootSession(), quietRootSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedMessages(client, { [ROOT_ID]: [], [CHILD_ID]: [] });
  seedPermissions(
    client,
    [
      rootPermission,
      permissionRequest({ id: 'perm_other', sessionID: OTHER_ROOT_ID }),
      permissionRequest({ id: PERM_OUTSIDE_ID, sessionID: OUTSIDE_SESSION_ID }),
    ],
    { bySession: { [ROOT_ID]: [rootPermission] } },
  );
  seedForms(client, {
    bySession: {
      [CHILD_ID]: [formInfo({ id: FORM_ID, sessionID: CHILD_ID, title: FORM_TITLE })],
    },
    details: {
      [CHILD_ID]: [formDetail({ id: FORM_ID, sessionID: CHILD_ID, title: FORM_TITLE })],
    },
  });
  seedDevice(client, false);
};

/**
 * Caso negativo: `FormDetail` pendiente de la hija **sin** su lista cruda
 * (`sessions.forms(CHILD_ID)` ausente) y el único permiso pendiente fuera del
 * subárbol abierto.
 */
const seedWithoutChildForms = (client: QueryClient): void => {
  seedQueryData(client, queryKeys.projects.list(), [
    project(INTEGRATION_DIRECTORY),
  ]);
  seedSessions(client, [rootSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedMessages(client, { [ROOT_ID]: [], [CHILD_ID]: [] });
  seedPermissions(client, [
    permissionRequest({ id: PERM_OUTSIDE_ID, sessionID: OUTSIDE_SESSION_ID }),
  ]);
  seedForms(client, {
    details: { [CHILD_ID]: [formDetail({ id: FORM_ID, sessionID: CHILD_ID })] },
  });
  seedDevice(client, false);
};

/** Mapa por raíz tal como lo expone `SessionListMarker` (`data-attention`). */
const readBadge = (): Record<string, number> => {
  const rail = screen.getByTestId(TESTID.sessionList);
  return JSON.parse(rail.getAttribute('data-attention') ?? '{}') as Record<
    string,
    number
  >;
};

const waitForBadge = async (expected: Record<string, number>): Promise<void> => {
  await waitFor(() => expect(readBadge()).toEqual(expected));
};

/** Ítem de atención tal como lo expone `ChatPanelMarker` (`data-attention`). */
interface TAttentionProbe {
  id: string;
  kind: string;
  sessionId: string;
  title: string;
}

const readChatAttention = (chat: HTMLElement): TAttentionProbe[] =>
  JSON.parse(chat.getAttribute('data-attention') ?? '[]') as TAttentionProbe[];

/** Activa la pestaña `Chat` del detalle (escritorio) para montar el panel. */
const openChatTab = async (): Promise<HTMLElement> => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), {
    button: 0,
  });
  return screen.findByTestId(TESTID.chatPanel);
};

/**
 * Emite una notificación **sin cambio de dato** sobre `queryKey`: crear un
 * observador real y volver a fijarle opciones dispara los eventos estructurales
 * (`observerResultsUpdated`/`observerOptionsUpdated`) que `useSessionAttention`
 * debe ignorar (R3). Es la tormenta que producía el observador de
 * `sessions.questions(id)` cuando `useSessionForms` corría su efecto.
 */
const notifyStructural = (
  client: QueryClient,
  queryKey: readonly unknown[],
): void => {
  const observer = new QueryObserver(client, { queryKey, enabled: false });
  observer.setOptions({ queryKey, enabled: false, staleTime: 1 });
  observer.destroy();
};

/** Recalculos del conteo por raíz (U5) observados desde el montaje. */
const badgeComputations = (): number =>
  vi.mocked(countAttentionByRoot).mock.results.length;

beforeEach(() => {
  resetServiceMock();
  vi.mocked(countAttentionByRoot).mockClear();
});

describe('integración U4↔U5 — badge por raíz y estabilidad del conteo (T014)', () => {
  it(
    'refleja la atención del subárbol y no se recalcula ante una notificación sin cambio de dato',
    async () => {
      const client = createIntegrationQueryClient();
      seedSubtreeWithPendings(client);

      await renderWorkspace(client);
      await screen.findByTestId(TESTID.agentGraph);
      await flushIdle();

      // (1) La raíz abierta suma su permiso del subárbol + la pregunta del nodo
      // `waiting-input` de la hija (1 + 1); `ses_other` solo su propia sesión;
      // `ses_quiet` sin pendientes cuenta 0; `ses_outside` no entra.
      await waitForBadge({
        [ROOT_ID]: 2,
        [OTHER_ROOT_ID]: 1,
        [QUIET_ROOT_ID]: 0,
      });
      expect(readBadge()).not.toHaveProperty(OUTSIDE_SESSION_ID);
      expect(readBadge()).not.toHaveProperty(CHILD_ID);

      // Etiquetas de hoy: la misma lista derivada por U4, expuesta por el chat,
      // toma el id/título del `FormInfo` cacheado y la acción del permiso.
      const chat = await openChatTab();
      await waitFor(() => expect(readChatAttention(chat)).toHaveLength(2));
      const attention = readChatAttention(chat);
      expect(attention.find((item) => item.kind === 'permission')).toMatchObject({
        id: PERM_ROOT_ID,
        sessionId: ROOT_ID,
        title: PERM_ACTION,
      });
      expect(attention.find((item) => item.kind === 'question')).toMatchObject({
        id: FORM_ID,
        sessionId: CHILD_ID,
        title: FORM_TITLE,
      });

      // (2) Sin cambio de dato no hay índice nuevo ni recómputo del conteo: el
      // memo de U5 conserva su última identidad y el badge no se mueve.
      const computations = badgeComputations();
      const badge = readBadge();
      expect(computations).toBeGreaterThan(0);

      act(() => {
        notifyStructural(client, queryKeys.sessions.forms(CHILD_ID));
        notifyStructural(client, queryKeys.sessions.questions(CHILD_ID));
      });

      expect(badgeComputations()).toBe(computations);
      expect(readBadge()).toEqual(badge);

      // (3) No vacuo: un cambio de DATO (un permiso nuevo en el subárbol) sí
      // recalcula y mueve el badge a 3 = 2 permisos + 1 pregunta.
      act(() => {
        client.setQueryData(queryKeys.permissions.list(), [
          permissionRequest({
            id: PERM_ROOT_ID,
            sessionID: ROOT_ID,
            action: PERM_ACTION,
          }),
          permissionRequest({ id: 'perm_other', sessionID: OTHER_ROOT_ID }),
          permissionRequest({
            id: PERM_OUTSIDE_ID,
            sessionID: OUTSIDE_SESSION_ID,
          }),
          permissionRequest({ id: 'perm_child_late', sessionID: CHILD_ID }),
        ]);
      });

      await waitForBadge({
        [ROOT_ID]: 3,
        [OTHER_ROOT_ID]: 1,
        [QUIET_ROOT_ID]: 0,
      });
      expect(badgeComputations()).toBeGreaterThan(computations);
    },
    // `15_000` y no `2_000`: el E2E tarda ~1,8 s y ese margen da flakiness; un
    // cuelgue real se corta desde fuera con `perl -e 'alarm shift; exec @ARGV' 120`.
    { timeout: 15_000 },
  );

  it(
    'una sesión fuera del subárbol y la ausencia de `sessions.forms(id)` dejan el conteo en 0',
    async () => {
      const client = createIntegrationQueryClient();
      seedWithoutChildForms(client);

      await renderWorkspace(client);
      await screen.findByTestId(TESTID.agentGraph);
      await flushIdle();

      // El `FormDetail` suelto no basta: sin la lista cruda el nodo no es
      // `waiting-input`, no hay pregunta, y el permiso ajeno no se cuenta.
      await waitForBadge({ [ROOT_ID]: 0 });

      const badge = readBadge();
      expect(badge[ROOT_ID]).toBe(0);
      expect(badge).not.toHaveProperty(OUTSIDE_SESSION_ID);
      expect(badge).not.toHaveProperty(CHILD_ID);

      // El workspace sigue sano: grafo montado y sin estado de error.
      expect(screen.getByTestId(TESTID.agentGraph)).toBeInTheDocument();
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    },
    // `15_000` y no `2_000`: el E2E tarda ~1,8 s y ese margen da flakiness; un
    // cuelgue real se corta desde fuera con `perl -e 'alarm shift; exec @ARGV' 120`.
    { timeout: 15_000 },
  );
});
