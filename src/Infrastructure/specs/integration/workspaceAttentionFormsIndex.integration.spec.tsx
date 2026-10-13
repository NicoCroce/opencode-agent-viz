import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@app/Domains/queryKeys';
import { formDetail, formInfo } from '../../lib/specs/fixtures';
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
  seedMessages,
  seedQueryData,
  seedSessions,
  seedSubtree,
} from './harness';

/**
 * T012 (013) — E2E de frontera **U6↔U4**: índice de formularios cacheados
 * (`sessions.forms(id)` → `useCachedForms`, contrato
 * `contracts/attention-forms-subscription.md` §2/§3/§5).
 *
 * Monta `WorkspacePage` con el modelo y los hooks **reales** (arnés compartido,
 * sin editar) y la caché sembrada: un nodo `waiting-input` del subárbol, del que
 * se cachean la lista cruda `sessions.forms(id)` (que lee el grafo para derivar
 * la espera, `enrichNodeData`) y su `FormDetail` `pending`. Sobre ese nodo,
 * `useSessionAttention` (U4) deriva un ítem de pregunta y su índice reactivo
 * `useCachedForms` lo enriquece con el `FormInfo` real; ese ítem viaja por el
 * **cableado real** de la página hasta la atención del chat
 * (`ChatPanelMarker.data-attention`) y hasta el realce del nodo
 * (`AgentGraphMarker.data-attention`). La prueba debe **terminar** (sin bucle de
 * render) y no muestra estado de error.
 *
 * Caso negativo (Principio VIII): con `sessions.forms(id)` **vacío** el índice no
 * encuentra `FormInfo` y el ítem conserva el respaldo de `deriveAttention`
 * (`id` = `question:<sessionId>`, `title` = título del nodo), sin error ni
 * cuelgue. Como un nodo solo llega a `waiting-input` con un formulario `pending`
 * en `sessions.forms(id)`, la lista se vacía tras el montaje (recarga del
 * listado sin formularios) para ejercer exactamente esa transición.
 *
 * `timeout: 15_000` (la unidad pedía 2_000): los E2E de este arnés tardan ~1,8 s
 * y ese margen produce flakiness; un cuelgue real no lo corta el `timeout` del
 * `it` (bloquea el hilo) y se corta desde fuera con `perl -e 'alarm shift; exec @ARGV'`.
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

/** Raíz abierta por la ruta (sesión de `/sessions/:id`). */
const ROOT_ID = INTEGRATION_SESSION_ID;
/** Hija del subárbol: el nodo `waiting-input` con el formulario pendiente. */
const CHILD_ID = INTEGRATION_CHILD_SESSION_ID;
/** Formulario `pending` que marca la espera y enriquece el ítem. */
const FORM_ID = 'form_index_child';
const FORM_TITLE = '¿Aplicar el cambio?';
/** Título del nodo: respaldo del ítem cuando no hay `FormInfo` cacheado. */
const CHILD_TITLE = 'hija en espera';

/** Ítem de atención tal como lo expone `ChatPanelMarker` (`data-attention`). */
interface TAttentionProbe {
  id: string;
  kind: string;
  sessionId: string;
  nodeId: string | null;
  title: string;
}

const rootSession = () => buildSessionInfo({ id: ROOT_ID });

const childSession = () =>
  buildSessionInfo({
    id: CHILD_ID,
    parentID: ROOT_ID,
    agent: 'question-agent',
    title: CHILD_TITLE,
    time: { created: 3, updated: 4 },
  });

/** Estructura mínima + presentación: raíz abierta y su hija en escritorio. */
const seedWorkspaceStructure = (client: QueryClient): void => {
  seedSessions(client, [rootSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedDevice(client, false);
};

/**
 * Siembra el nodo `waiting-input` de la hija: la lista cruda
 * (`sessions.forms(id)`), el `FormDetail` `pending` que marca la espera y los
 * mensajes vacíos, que dejan el nodo listo para el enriquecimiento y evitan que
 * el lote de idle llame a `loadNodeContent` y pise los formularios sembrados.
 */
const seedWaitingInputChild = (client: QueryClient): void => {
  seedMessages(client, { [ROOT_ID]: [], [CHILD_ID]: [] });
  seedForms(client, {
    bySession: {
      [CHILD_ID]: [
        formInfo({ id: FORM_ID, sessionID: CHILD_ID, title: FORM_TITLE }),
      ],
    },
    details: {
      [CHILD_ID]: [
        formDetail({ id: FORM_ID, sessionID: CHILD_ID, title: FORM_TITLE }),
      ],
    },
  });
};

/** Monta la página y deja correr los lotes de idle del enriquecimiento. */
const mountWorkspace = async (client: QueryClient): Promise<void> => {
  await renderWorkspace(client);
  await screen.findByTestId(TESTID.agentGraph);
  await flushIdle();
  await flushIdle();
};

/** Activa la pestaña `Chat` del detalle (escritorio) para montar la atención. */
const openChatTab = async (): Promise<HTMLElement> => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), { button: 0 });
  return screen.findByTestId(TESTID.chatPanel);
};

/** Atención derivada por U4 tal como llega al `ChatPanel`. */
const readAttention = (chat: HTMLElement): TAttentionProbe[] =>
  JSON.parse(chat.getAttribute('data-attention') ?? '[]') as TAttentionProbe[];

/** Nodos realzados por `useAttentionNodeIds` en el marcador del grafo. */
const graphAttention = (): string =>
  screen.getByTestId(TESTID.agentGraph).getAttribute('data-attention') ?? '';

describe('integración U6↔U4 — índice de formularios cacheados en la atención (T012)', () => {
  beforeEach(() => {
    resetServiceMock();
  });

  it(
    'enriquece el ítem de pregunta con el FormInfo de sessions.forms(id) y lo lleva al nodo',
    async () => {
      const client = createIntegrationQueryClient();
      seedWorkspaceStructure(client);
      seedWaitingInputChild(client);

      await mountWorkspace(client);
      const chat = await openChatTab();

      let items: TAttentionProbe[] = [];
      await waitFor(() => {
        items = readAttention(chat);
        expect(items).toHaveLength(1);
      });

      // El `id`/`title` salen del `FormInfo` cacheado (no del título del nodo):
      // el índice `useCachedForms` encontró el formulario de `sessions.forms(id)`.
      expect(items[0]).toMatchObject({
        id: FORM_ID,
        kind: 'question',
        sessionId: CHILD_ID,
        nodeId: CHILD_ID,
        title: FORM_TITLE,
      });

      // La cadena llega también al nodo: el realce del grafo señala la hija.
      await waitFor(() => expect(graphAttention()).toBe(CHILD_ID));
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    },
    { timeout: 15_000 },
  );

  it(
    'con sessions.forms(id) vacío conserva el respaldo question:<sessionId> sin error ni cuelgue',
    async () => {
      const client = createIntegrationQueryClient();
      seedWorkspaceStructure(client);
      seedWaitingInputChild(client);

      await mountWorkspace(client);
      const chat = await openChatTab();

      // Punto de partida: el índice enriquece el ítem con el formulario cacheado.
      await waitFor(() => expect(readAttention(chat)[0]?.id).toBe(FORM_ID));

      // `sessions.forms(id)` vuelve a estar vacío (recarga del listado sin
      // formularios): el índice no encuentra `FormInfo` y el ítem cae al respaldo.
      act(() => {
        seedQueryData(client, queryKeys.sessions.forms(CHILD_ID), []);
      });

      await waitFor(() => {
        const [item] = readAttention(chat);
        expect(item).toMatchObject({
          id: `question:${CHILD_ID}`,
          kind: 'question',
          sessionId: CHILD_ID,
          nodeId: CHILD_ID,
          title: CHILD_TITLE,
        });
      });

      // El nodo sigue realzado y el workspace, sano: sin error ni cuelgue.
      expect(graphAttention()).toBe(CHILD_ID);
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    },
    { timeout: 15_000 },
  );
});
