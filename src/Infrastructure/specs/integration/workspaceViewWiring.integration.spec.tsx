/**
 * U27 (T023) — E2E de la frontera U2↔U3: **cableado de la vista**.
 *
 * Monta `WorkspacePage` con el modelo, los hooks reales y la red bajo control del
 * test (arnés de `./harness`) y comprueba que los **cinco slots** que construye la
 * página —`sessions`, `graph`, `inspector`, `chat` y `history`— llegan a
 * `WorkspaceView` con sus mismas props (`data-*` de los marcadores y los
 * `data-testid` congelados) y que el `attentionCount` del subárbol es el correcto.
 *
 * Camino feliz: la sesión `ses_root` está abierta, su contenido (mensajes) ya está
 * en caché y tiene un permiso abierto; el enriquecimiento deja el nodo
 * `waiting-permission`, la atención derivada (U4) vale `1` y ese valor viaja como
 * `attentionCount` hasta el badge del tab `Chat` (contexto de la vista en móvil,
 * prop del panel de detalle en escritorio).
 *
 * Caso negativo (dato inexistente): **sin `:id` en la ruta** no hay sesión abierta
 * ⇒ el slot `chat` es `null` (la página no lo construye) y el resto de slots se
 * montan igual, sin forzar ningún estado de error (Principio VI: "vacío" no es
 * "error" ni "no encontrada"). `renderWorkspace` del arnés siempre monta la ruta
 * `/sessions/:id` (React Router no matchea `/sessions/` contra `:id`), así que el
 * caso negativo monta la página en una ruta **sin parámetro**: es la única forma
 * de ejercer la rama `id ? … : null` de la página.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Project } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import { permissionRequest } from '../../lib/specs/fixtures';
import {
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  TESTID,
  buildSessionInfo,
  createIntegrationQueryClient,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedPermissions,
  seedQueryData,
  seedSessions,
  seedSubtree,
  serviceMock,
} from './harness';

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

/**
 * `data-testid` congelado del contenedor del slot `chat` dentro del tablist
 * `Detalle | Chat` (contrato de superficie §3): permite comprobar que la vista
 * reserva el slot aunque la página lo entregue `null`.
 */
const DETAIL_CHAT_SLOT_TESTID = 'detail-chat-slot';

/** Etiqueta accesible del badge de atención con un único pendiente. */
const ONE_PENDING_LABEL = '1 pendiente por atender';

/** Proyecto descubierto por `/project`: dirige la query de raíces del rail. */
const buildProject = (canonical: string): Project => ({
  id: canonical,
  canonical,
  time: { created: 1, updated: 1, active: 1 },
  sandboxes: [],
});

/** Permiso abierto de la sesión abierta: el pendiente que alimenta la atención. */
const openPermission = permissionRequest({
  id: 'perm_root',
  sessionID: INTEGRATION_SESSION_ID,
});

/**
 * Siembra el workspace de la sesión abierta: proyectos (raíces del rail),
 * listado y subárbol de `ses_root`, sus mensajes (contenido ya en caché ⇒ el nodo
 * se enriquece sin red) y el permiso abierto que hace que la atención del
 * subárbol valga `1`.
 */
const seedOpenWorkspace = (client: QueryClient): void => {
  seedQueryData(client, queryKeys.projects.list(), [buildProject(INTEGRATION_DIRECTORY)]);
  seedSessions(client, [buildSessionInfo()]);
  seedSubtree(client, [buildSessionInfo()]);
  seedMessages(client, { [INTEGRATION_SESSION_ID]: [] });
  seedPermissions(client, [openPermission], {
    bySession: { [INTEGRATION_SESSION_ID]: [openPermission] },
  });
};

/**
 * Caso negativo: la página se monta en una ruta **sin `:id`**, de modo que
 * `useParams()` queda vacío (la rama "sin sesión abierta" de la página). El resto
 * del montaje (providers, cliente y dobles de barrel) es el mismo del arnés.
 */
const renderWorkspaceWithoutSession = async (client: QueryClient) => {
  const { WorkspacePage } = await import('../../WorkspacePage');

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/**
 * Margen explícito para el E2E completo: monta la página real con los cinco
 * slots y corre en ~4,5 s con la máquina libre, muy cerca del límite por defecto
 * de Vitest (5 s) y por encima de él bajo carga. 20 s es >2× lo observado y no
 * debilita ninguna aserción: sólo evita el falso fallo por timeout.
 */
const INTEGRATION_TIMEOUT_MS = 20_000;

describe('WorkspaceView — cableado de los cinco slots (T023, U2↔U3)', () => {
  beforeEach(() => {
    resetServiceMock();
  });

  it('escritorio: los cinco slots llegan con sus props/data-testid y el attentionCount del subárbol', async () => {
    const client = createIntegrationQueryClient();
    seedOpenWorkspace(client);
    seedDevice(client, false);

    await renderWorkspace(client);

    const graph = await screen.findByTestId(TESTID.agentGraph);

    // Slot `sessions`: el rail recibe los grupos del listado y la sesión abierta.
    const rail = screen.getByTestId(TESTID.sessionList);
    expect(rail).toHaveAttribute('data-group-count', '1');
    expect(rail).toHaveAttribute('data-selected', INTEGRATION_SESSION_ID);

    // Slot `graph`: el modelo construido por los hooks llega con su nodo
    // enriquecido (`enrichment: 'ready'`) y con los handlers cableados.
    expect(graph).toHaveAttribute(
      'data-nodes',
      JSON.stringify([{ id: INTEGRATION_SESSION_ID, enrichment: 'ready' }]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));
    expect(graph).toHaveAttribute('data-selected', INTEGRATION_SESSION_ID);

    // Slot `inspector`: inspecciona la raíz abierta por defecto (`useChainSelection`).
    expect(screen.getByTestId(TESTID.inspectorPanel)).toHaveAttribute(
      'data-node',
      INTEGRATION_SESSION_ID,
    );

    // `attentionCount`: el pendiente del subárbol (U4) llega al badge del tab.
    expect(
      screen.getByRole('img', { name: ONE_PENDING_LABEL }),
    ).toBeInTheDocument();

    // Slot `history`: abrir el histórico desde el grafo monta el overlay con el nodo.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir histórico' }));
    expect(
      await screen.findByTestId(TESTID.historyModal),
    ).toHaveAttribute('data-node', INTEGRATION_SESSION_ID);

    // Slot `chat`: en escritorio vive en la pestaña `Chat` del detalle, armado por
    // los hooks (sesión abierta, directorio resuelto y semilla del nodo).
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), {
      button: 0,
    });
    const chat = await screen.findByTestId(TESTID.chatPanel);
    expect(chat).toHaveAttribute('data-session-id', INTEGRATION_SESSION_ID);
    expect(chat).toHaveAttribute('data-directory', INTEGRATION_DIRECTORY);
    expect(chat).toHaveAttribute(
      'data-selection',
      JSON.stringify({ agent: 'develop', model: null }),
    );
  });

  it('móvil: el chat es un slot de primer nivel y el attentionCount viaja por el contexto de la vista', async () => {
    const client = createIntegrationQueryClient();
    seedOpenWorkspace(client);
    seedDevice(client, true);

    await renderWorkspace(client);

    expect(await screen.findByTestId(TESTID.agentGraph)).toBeInTheDocument();

    // El único tab de primer nivel lo monta la vista; el badge sale del
    // `attentionCount` que `WorkspaceView` publica en el contexto.
    expect(
      screen.getByRole('img', { name: ONE_PENDING_LABEL }),
    ).toBeInTheDocument();

    // Slot `sessions`: el rail se monta en su tab con la sesión abierta.
    fireEvent.click(screen.getByRole('tab', { name: 'sessions' }));
    expect(screen.getByTestId(TESTID.sessionList)).toHaveAttribute(
      'data-selected',
      INTEGRATION_SESSION_ID,
    );

    // Slot `chat`: el panel llega al tab de primer nivel con la sesión abierta.
    fireEvent.click(screen.getByRole('tab', { name: /^chat/ }));
    expect(await screen.findByTestId(TESTID.chatPanel)).toHaveAttribute(
      'data-session-id',
      INTEGRATION_SESSION_ID,
    );
  });

  it('sin sesión (`:id` ausente): el slot `chat` es `null`, el resto se monta y no hay estados de error forzados', async () => {
    const client = createIntegrationQueryClient();
    // El dato que falta es la **sesión abierta**; el listado sigue disponible.
    seedQueryData(client, queryKeys.projects.list(), [
      buildProject(INTEGRATION_DIRECTORY),
    ]);
    seedSessions(client, [buildSessionInfo()]);
    seedDevice(client, false);

    await renderWorkspaceWithoutSession(client);

    // Slots `sessions` e `inspector` montados, con el dato que sí existe.
    expect(screen.getByTestId(TESTID.sessionList)).toHaveAttribute(
      'data-selected',
      '',
    );
    expect(screen.getByTestId(TESTID.inspectorPanel)).toBeInTheDocument();

    // Slot `graph`: panel montado en vacío, sin forzar error ni carga.
    expect(screen.getByText('Sin agentes')).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
    expect(screen.queryByText('Sesión no encontrada')).not.toBeInTheDocument();
    expect(screen.queryByTestId(TESTID.graphSkeleton)).not.toBeInTheDocument();

    // Slot `chat`: `null`, así que no hay panel ni badge de atención.
    expect(screen.queryByTestId(TESTID.chatPanel)).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-attention-badge')).not.toBeInTheDocument();

    // La vista reserva el slot del chat: llega vacío, no ausente.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), {
      button: 0,
    });
    const chatSlot = await screen.findByTestId(DETAIL_CHAT_SLOT_TESTID);
    expect(chatSlot).toBeEmptyDOMElement();

    // Sin sesión no se fuerza ninguna consulta de respaldo del directorio.
    expect(serviceMock.getSession).not.toHaveBeenCalled();
  });
}, INTEGRATION_TIMEOUT_MS);
