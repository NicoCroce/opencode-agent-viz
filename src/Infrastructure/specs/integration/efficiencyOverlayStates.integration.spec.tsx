/**
 * U38 (T060) — E2E de la frontera U2↔U5: **overlay §4**.
 *
 * Monta `WorkspacePage` con el arnés y abre el overlay desde el disparador real
 * de `GraphPane` para recorrer la precedencia de estados del informe:
 *
 *   cerrado → carga → error → vacío → en curso → insuficiente → ok → parcial
 *   → truncado → no actualizado
 *
 * En todos los estados el header y “Cerrar” siguen montados (FR-036). Los
 * negativos aseguran que el error nunca se confunde con el vacío, que un fallo
 * de actualización conserva el informe previo y que parcial/truncado añaden su
 * banner sin sustituir el veredicto. Un grafo truncado mantiene el informe
 * `ok` pero rebaja la confianza a `baja`; sin truncar, el mismo informe sube a
 * `media`.
 */
import { act, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionMessageAssistant, SessionStatus } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '@app/Domains/queryKeys';
import { STATUS_LABEL } from '@app/Domains/Efficiency/lib/labels';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import { setupRadixUser } from '@app/test/radix';
import {
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  TESTID,
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
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
const INTEGRATION_TIMEOUT_MS = 20_000;

const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
];

const toolAt = (
  id: string,
  start: number,
  offset: number,
): SessionMessageAssistant['content'][number] => {
  const created = start + offset;
  return buildToolPart({
    id,
    name: 'read',
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + 100,
  });
};

const turnMessages = (index: number): TSessionMessage[] => {
  const start = BASE + index * TURN_MS;
  return [
    buildUser({
      id: `user-${index}`,
      text: PROMPTS[index - 1],
      time: { created: start },
    }),
    buildAssistant({
      id: `assistant-${index}-a`,
      time: { created: start + 100, completed: start + 2_000 },
      content: [
        toolAt(`tool-${index}-a`, start, 200),
        toolAt(`tool-${index}-b`, start, 300),
      ],
    }),
    buildAssistant({
      id: `assistant-${index}-b`,
      time: { created: start + 2_100, completed: start + 3_000 },
      content: [toolAt(`tool-${index}-c`, start, 400)],
    }),
    buildIdle('succeeded', {
      id: `idle-${index}`,
      time: { created: start + 5_000 },
    }),
  ];
};

/** Cuatro turnos cerrados: muestra suficiente para puntuar (`ok`). */
const scoredMessages = (): TSessionMessage[] =>
  [1, 2, 3, 4].flatMap(turnMessages);

/** Un único turno cerrado: muestra insuficiente, sin nota. */
const insufficientMessages = (): TSessionMessage[] => {
  const start = BASE;
  return [
    buildUser({
      id: 'user-solo',
      text: PROMPTS[0],
      time: { created: start },
    }),
    buildAssistant({
      id: 'assistant-solo',
      time: { created: start + 100, completed: start + 900 },
      content: [toolAt('tool-solo', start, 200)],
    }),
    buildIdle('succeeded', {
      id: 'idle-solo',
      time: { created: start + 5_000 },
    }),
  ];
};

const childMessages = (): TSessionMessage[] => [
  buildAssistant({
    id: 'child-assistant',
    time: { created: BASE + 100, completed: BASE + 900 },
    content: [toolAt('child-tool', BASE, 200)],
  }),
];

const BUSY: SessionStatus = { type: 'busy' };

const seedWorkspace = (
  client: QueryClient,
  {
    status = {},
    truncated = false,
    notFound = false,
    child = false,
    messages = {},
  }: {
    status?: Record<string, SessionStatus>;
    truncated?: boolean;
    notFound?: boolean;
    /** Incluye la hija en el subárbol (aunque no tenga mensajes). */
    child?: boolean;
    messages?: Record<string, TSessionMessage[]>;
  } = {},
): void => {
  const root = buildSessionInfo();
  const sessions = [
    root,
    ...(child ? [buildSessionInfo({ id: CHILD, parentID: ROOT })] : []),
  ];
  seedSessions(client, notFound ? [] : [root], { status });
  seedSubtree(client, notFound ? [] : sessions, {
    truncated,
    notFound,
  });
  seedMessages(client, messages);
  seedDevice(client, false);
};

const openEfficiency = async (): Promise<HTMLElement> => {
  const user = setupRadixUser();
  await user.click(screen.getByRole('button', { name: 'Eficiencia' }));
  return screen.findByRole('dialog', { name: 'Eficiencia de la sesión' });
};

/** FR-036: header, subtítulo y “Cerrar” sobreviven a todos los estados. */
const expectHeaderAndClose = (): void => {
  expect(screen.getByText('Eficiencia de la sesión')).toBeVisible();
  expect(
    screen.getByText('Análisis de solo lectura de la sesión y su subárbol.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Cerrar análisis de eficiencia' }),
  ).toBeVisible();
};

/** Fuerza el fallo de red del subárbol conservando los datos previos. */
const failSubtree = async (client: QueryClient): Promise<void> => {
  serviceMock.listChildSessions.mockRejectedValue(new Error('fallo de red'));
  await act(async () => {
    // El cargador resuelve las hijas con `fetchQuery`: si no se invalida esa
    // clave, devuelve la copia fresca de la caché y el refetch no toca la red.
    await client.invalidateQueries({
      queryKey: queryKeys.sessions.children(ROOT),
    });
    await client.invalidateQueries({
      queryKey: queryKeys.graph.for(INTEGRATION_DIRECTORY, ROOT),
    });
  });
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.graph.for(INTEGRATION_DIRECTORY, ROOT))
        ?.status,
    ).toBe('error'),
  );
};

beforeEach(() => {
  resetServiceMock();
});

describe('integración U2↔U5 — precedencia de estados del overlay', () => {
  it('recorre cerrado → carga → vacío conservando header y “Cerrar”', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client);
    serviceMock.getSessionMessages.mockImplementation(
      () => new Promise<TSessionMessage[]>(() => {}),
    );

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);

    // Cerrado: Radix no monta el contenido y el hook no observa la caché.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Cargando análisis…')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Eficiencia' }),
    ).toHaveAttribute('aria-haspopup', 'dialog');

    // Carga: la raíz aún no tiene caché ni `rootReady`.
    await openEfficiency();
    expectHeaderAndClose();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando análisis…');
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();

    // Vacío: la raíz ya está lista y reportó `[]`.
    act(() => {
      seedMessages(client, { [ROOT]: [] });
    });
    await flushIdle();

    expect(await screen.findByText('Sin mensajes')).toBeInTheDocument();
    expectHeaderAndClose();
    expect(screen.queryByText('Cargando análisis…')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No se pudo cargar la sesión.'),
    ).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('error sin informe muestra EmptyScreenError y nunca el vacío', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client);
    serviceMock.getSessionMessages.mockImplementation(
      () => new Promise<TSessionMessage[]>(() => {}),
    );

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);

    await failSubtree(client);
    expect(await screen.findByText('fallo de red')).toBeInTheDocument();

    await openEfficiency();
    expectHeaderAndClose();
    expect(screen.getByText('No se pudo cargar la sesión.')).toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Esta sesión todavía no reportó mensajes.'),
    ).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('una sesión inexistente no ofrece análisis ni se confunde con el vacío', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, { notFound: true });

    await renderWorkspace(client);
    await flushIdle();

    expect(await screen.findByText('Sesión no encontrada')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Eficiencia' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('en curso prevalece y no muestra nota', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, {
      status: { [CHILD]: BUSY },
      child: true,
      messages: {
        [ROOT]: scoredMessages(),
        [CHILD]: childMessages(),
      },
    });

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    expectHeaderAndClose();
    expect(screen.getByText('Sesión en curso: sin nota')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /de 100/ })).not.toBeInTheDocument();
    expect(screen.getByText('Datos disponibles')).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('muestra insuficiente con su motivo y sin veredicto', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, { messages: { [ROOT]: insufficientMessages() } });

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    expectHeaderAndClose();
    expect(screen.getByText(STATUS_LABEL.insufficient)).toBeInTheDocument();
    expect(
      screen.getByText(/Menos de 2 turnos cerrados \(1\)\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /de 100/ })).not.toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('con datos pinta veredicto, turnos y totales', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, { messages: { [ROOT]: scoredMessages() } });

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    expectHeaderAndClose();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(screen.getByText('confianza media')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Turnos de la sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(screen.queryByText(/Análisis parcial/)).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('parcial declara las sesiones sin datos y conserva el informe', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, {
      child: true,
      messages: { [ROOT]: scoredMessages() },
    });
    serviceMock.getSessionMessages.mockRejectedValue(new Error('sin datos'));

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    expectHeaderAndClose();
    expect(
      screen.getByText('Análisis parcial: 1 sesiones sin datos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('truncado deja el informe ok en confianza baja y añade su banner', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, {
      truncated: true,
      messages: { [ROOT]: scoredMessages() },
    });

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    expectHeaderAndClose();
    expect(
      screen.getByText('El grafo está truncado: faltan agentes del subárbol.'),
    ).toBeInTheDocument();
    // El informe sigue siendo `ok`: hay nota y no aparece la guarda de muestra.
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(screen.queryByText('Muestra insuficiente')).not.toBeInTheDocument();
    // Un grafo truncado es subárbol parcial para el motor: nunca confianza alta.
    expect(screen.getByText('confianza baja')).toBeInTheDocument();
    expect(screen.queryByText('confianza alta')).not.toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Turnos de la sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Análisis parcial/)).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('un fallo de actualización conserva el informe previo y avisa', async () => {
    const client = createIntegrationQueryClient();
    seedWorkspace(client, { messages: { [ROOT]: scoredMessages() } });

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();

    await failSubtree(client);

    expect(
      await screen.findByText(
        'No se pudieron actualizar los datos; se muestra el último análisis.',
      ),
    ).toBeInTheDocument();
    expectHeaderAndClose();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(
      screen.queryByText('No se pudo cargar la sesión.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);
});
