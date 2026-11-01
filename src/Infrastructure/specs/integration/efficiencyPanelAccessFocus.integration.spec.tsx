/**
 * U37 (T039) — E2E de la frontera U4↔U5↔U6: **overlay §1/§2/§3 + data-model §5.3**.
 *
 * Monta `WorkspacePage` con el arnés (modelo, hooks y barrels reales; red bajo
 * control del test) y ejerce el acceso al panel desde la cabecera del grafo:
 * pulsar `Eficiencia` monta el `dialog` con foco atrapado, `Escape` lo cierra y
 * devuelve el foco al disparador. `now` viaja como `openedAt` y el turno abierto
 * lo usa para su tiempo. Cambiar de sesión raíz cierra el panel.
 *
 * Casos negativos: carga, error, sesión no encontrada, “sin agentes” y raíz 404
 * no montan el botón; si el disparador desaparece antes de cerrar, no se fuerza
 * un foco inválido ni se lanza.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import type { Project, SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { formatDuration } from '@app/Application/Helpers';
import { queryKeys } from '@app/Domains/queryKeys';
import { setupRadixUser } from '@app/test/radix';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import {
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  TESTID,
  buildSessionInfo,
  createIntegrationQueryClient,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
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

const ROOT = INTEGRATION_SESSION_ID;
const CHILD = INTEGRATION_CHILD_SESSION_ID;
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const TOOLS_OPEN = 4;
const OPEN_USER_AT = BASE + 200_000;
/** Veinte minutos después de abrir el pedido: `2m 5s` en la tabla. */
const OPEN_DURATION_MS = 125_000;
const OPENED_AT = OPEN_USER_AT + OPEN_DURATION_MS;

const CLOSED_PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
];
const OPEN_PROMPT =
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador';

const DIALOG_NAME = 'Eficiencia de la sesión';

const buildProject = (canonical: string): Project => ({
  id: canonical,
  canonical,
  time: { created: 1, updated: 1, active: 1 },
  sandboxes: [],
});

const toolAt = (
  id: string,
  start: number,
  position: number,
): SessionMessageAssistant['content'][number] => {
  const created = start + 200 + position * 10;
  return buildToolPart({
    id,
    name: 'read',
    status: 'completed',
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + 100,
  });
};

interface TTurnOptions {
  closed: boolean;
}

/** Turno con dos pasos assistant y cinco herramientas (10 calls, 4 steps). */
const turnMessages = (
  index: number,
  start: number,
  prompt: string,
  { closed }: TTurnOptions,
): TSessionMessage[] => {
  const openContent: SessionMessageAssistant['content'] = Array.from(
    { length: TOOLS_OPEN },
    (_, position) => toolAt(`tool-${index}-${position}`, start, position),
  );
  const closeContent: SessionMessageAssistant['content'] = [
    toolAt(`tool-${index}-close`, start + 500, TOOLS_OPEN),
  ];

  const messages: TSessionMessage[] = [
    buildUser({ id: `user-${index}`, text: prompt, time: { created: start } }),
    buildAssistant({
      id: `assistant-${index}-open`,
      time: { created: start + 100, completed: start + 2_000 },
      content: openContent,
    }),
    buildAssistant({
      id: `assistant-${index}-close`,
      time: { created: start + 2_100, completed: start + 2_500 },
      content: closeContent,
    }),
  ];

  if (closed) {
    messages.push(
      buildIdle('succeeded', {
        id: `idle-${index}`,
        time: { created: start + 5_000 },
      }),
    );
  }

  return messages;
};

/**
 * Tres turnos cerrados y uno abierto (sin `idle`): el informe puntúa y el último
 * turno ejerce la duración con el `now` del panel.
 */
const rootMessages = (): TSessionMessage[] => [
  ...CLOSED_PROMPTS.flatMap((prompt, position) =>
    turnMessages(position + 1, BASE + position * TURN_MS, prompt, {
      closed: true,
    }),
  ),
  ...turnMessages(4, OPEN_USER_AT, OPEN_PROMPT, { closed: false }),
];

const seedEfficiencyWorkspace = (client: QueryClient): void => {
  const root = buildSessionInfo();
  const child = buildSessionInfo({
    id: CHILD,
    title: 'subagente',
    parentID: ROOT,
  });

  seedQueryData(client, queryKeys.projects.list(), [
    buildProject(INTEGRATION_DIRECTORY),
  ]);
  seedSessions(client, [root, child]);
  seedSubtree(client, [root, child]);
  seedSubtree(client, [child], { sessionId: CHILD });
  seedMessages(client, { [ROOT]: rootMessages(), [CHILD]: [] });
  seedDevice(client, false);
};

/** Control de navegación junto a la página para cambiar de sesión raíz. */
const NavToChild = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void navigate(`/sessions/${CHILD}`);
      }}
    >
      Ir a la sesión hija
    </button>
  );
};

/**
 * Monta `WorkspacePage` con el mismo contrato que `renderWorkspace` del arnés,
 * más un control de navegación para ejercer el cambio de raíz. La importación es
 * diferida para no evaluar la página durante la construcción de los mocks.
 */
const renderWorkspaceWithNav = async (client: QueryClient) => {
  const { WorkspacePage } = await import('../../WorkspacePage');

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/sessions/${ROOT}`]}>
        <NavToChild />
        <Routes>
          <Route path="/sessions/:id" element={<WorkspacePage />} />
          <Route
            path="/sessions"
            element={<div data-testid="sessions-list-route" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const efficiencyTrigger = (): HTMLElement =>
  screen.getByRole('button', { name: 'Eficiencia' });

const openDialog = async (): Promise<HTMLElement> =>
  screen.findByRole('dialog', { name: DIALOG_NAME });

const dialogClosed = (): void => {
  expect(screen.queryByRole('dialog', { name: DIALOG_NAME })).toBeNull();
};

const triggerMounted = (): boolean =>
  screen.queryByRole('button', { name: 'Eficiencia' }) !== null;

const INTEGRATION_TIMEOUT_MS = 30_000;

describe('WorkspacePage · acceso, foco y cierre del panel de eficiencia (T039)', () => {
  beforeEach(() => {
    resetServiceMock();
  });

  it('abre el diálogo con foco atrapado, cierra con Escape y devuelve el foco; now es openedAt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(OPENED_AT);
    const client = createIntegrationQueryClient();
    seedEfficiencyWorkspace(client);

    const view = await renderWorkspaceWithNav(client);
    await screen.findByTestId(TESTID.agentGraph);

    const user = setupRadixUser();
    const trigger = efficiencyTrigger();
    await user.click(trigger);

    const dialog = await openDialog();
    const close = screen.getByRole('button', {
      name: 'Cerrar análisis de eficiencia',
    });
    await waitFor(() => expect(close).toHaveFocus());
    expect(dialog.contains(document.activeElement)).toBe(true);

    // El foco no escapa del diálogo al recorrer sus controles.
    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    // `now` = `openedAt`: el turno abierto usa ese reloj para su tiempo.
    const openHeader = screen.getByRole('rowheader', { name: /^4\b/ });
    const openRow = openHeader.closest('tr');
    if (openRow === null) throw new Error('Fila del turno abierto ausente');
    expect(within(openRow).getByText('abierto')).toBeInTheDocument();
    expect(
      within(openRow).getByText(formatDuration(OPEN_DURATION_MS)),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(dialogClosed);
    await waitFor(() => expect(trigger).toHaveFocus());

    view.unmount();
  });

  it('cambiar la sesión raíz cierra el panel', async () => {
    const client = createIntegrationQueryClient();
    seedEfficiencyWorkspace(client);

    const view = await renderWorkspaceWithNav(client);
    await screen.findByTestId(TESTID.agentGraph);

    const user = setupRadixUser();
    const navToChild = screen.getByRole('button', {
      name: 'Ir a la sesión hija',
    });
    await user.click(efficiencyTrigger());
    await openDialog();

    await user.click(navToChild);

    await waitFor(dialogClosed);
    // La nueva raíz se monta con su propio subárbol (un agente).
    expect(await screen.findByText('1 agentes')).toBeInTheDocument();

    view.unmount();
  });

  it('si el disparador se desmonta antes de cerrar no fuerza un foco inválido ni lanza', async () => {
    const client = createIntegrationQueryClient();
    seedEfficiencyWorkspace(client);

    const view = await renderWorkspaceWithNav(client);
    await screen.findByTestId(TESTID.agentGraph);

    const user = setupRadixUser();
    const trigger = efficiencyTrigger();
    await user.click(trigger);
    await openDialog();

    // El subárbol deja de tener nodos: la cabecera del grafo desmonta el botón.
    act(() => {
      client.setQueryData(queryKeys.graph.for(INTEGRATION_DIRECTORY, ROOT), {
        sessions: [],
        truncated: false,
        loadedCount: 0,
        notFound: false,
      });
    });

    expect(await screen.findByText('Sin agentes')).toBeInTheDocument();
    await waitFor(() => expect(triggerMounted()).toBe(false));
    expect(trigger.isConnected).toBe(false);

    await user.keyboard('{Escape}');

    await waitFor(dialogClosed);
    expect(document.activeElement).not.toBe(trigger);
    expect(document.activeElement?.isConnected ?? true).toBe(true);

    view.unmount();
  });

  it('en carga, error, no encontrada, sin agentes y raíz 404 no monta el botón', async () => {
    interface TScenario {
      nombre: string;
      setup: (client: QueryClient) => void;
      waitFor: () => Promise<unknown>;
    }

    const seedRoot = (client: QueryClient): void => {
      seedQueryData(client, queryKeys.projects.list(), [
        buildProject(INTEGRATION_DIRECTORY),
      ]);
      seedSessions(client, [buildSessionInfo()]);
    };

    const scenarios: TScenario[] = [
      {
        nombre: 'carga',
        setup: () => {
          serviceMock.getSession.mockReturnValue(
            new Promise<never>(() => undefined),
          );
        },
        waitFor: () => screen.findByTestId(TESTID.graphSkeleton),
      },
      {
        nombre: 'error',
        setup: (client) => {
          seedSessions(client, [
            buildSessionInfo({ id: 'otra_sesion', title: 'otra' }),
          ]);
          serviceMock.getSession.mockRejectedValue(new Error('fallo de red'));
        },
        waitFor: () =>
          screen.findByText('Ocurrió un error al cargar los datos'),
      },
      {
        nombre: 'no encontrada',
        setup: (client) => {
          seedRoot(client);
          seedSubtree(client, [], { notFound: true });
        },
        waitFor: () => screen.findByText('Sesión no encontrada'),
      },
      {
        nombre: 'sin agentes',
        setup: (client) => {
          seedRoot(client);
          seedSubtree(client, []);
        },
        waitFor: () => screen.findByText('Sin agentes'),
      },
      {
        nombre: 'raíz 404',
        setup: (client) => {
          seedSessions(client, [
            buildSessionInfo({ id: 'otra_sesion', title: 'otra' }),
          ]);
          serviceMock.getSession.mockRejectedValue({
            _tag: 'SessionNotFoundError',
            sessionID: ROOT,
            message: 'la sesión no existe',
          });
        },
        waitFor: () => screen.findByText('Sesión no encontrada'),
      },
    ];

    for (const scenario of scenarios) {
      resetServiceMock();
      const client = createIntegrationQueryClient();
      seedDevice(client, false);
      scenario.setup(client);

      const view = await renderWorkspace(client);
      await scenario.waitFor();

      expect(
        screen.queryByRole('button', { name: 'Eficiencia' }),
        `en “${scenario.nombre}” no debe montarse el botón`,
      ).not.toBeInTheDocument();

      view.unmount();
    }
  });
}, INTEGRATION_TIMEOUT_MS);
