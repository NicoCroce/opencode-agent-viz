/**
 * U21 (T030) — E2E de frontera **U6↔U2↔U4**: consulta de mensajes → cuatro
 * secciones técnicas del detalle.
 *
 * Monta el `InspectorPanel` **real** (no el marcador) con `renderWithProviders`
 * + `createIntegrationQueryClient` del arnés (`./harness`) y el SDK mockeado por
 * `serviceMock`/`resetServiceMock`. La fuente de las cuatro secciones sin estado
 * propio (Subagentes, Herramientas, Respuestas y Errores) es la consulta de
 * mensajes de `useInspectorData` (`sessions.messages(id)`); el resto del panel
 * resuelve sus propias fuentes.
 *
 * Cubre `contracts/inspector-section-tabs-contract.md` §5 y `data-model.md` §3
 * (FR-008/SC-005, Principio VI):
 *
 * 1. **Camino feliz (carga)**: con la consulta pendiente, las cuatro muestran su
 *    esqueleto (`ListSkeleton`) y **nunca** su texto de vacío.
 * 2. **Camino feliz (datos)**: con mensajes sembrados, las cuatro muestran sus
 *    listados reales.
 * 3. **Caso negativo (dato inexistente / 404)**: `getSessionMessages` rechaza
 *    (sesión inexistente) ⇒ las cuatro muestran error y **nunca** el vacío.
 * 4. **Vacío legítimo**: resuelta la consulta sin mensajes, el vacío aparece
 *    (y no antes de resolver).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { JsonValue, SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '@app/Domains/queryKeys';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  seedMessages,
  seedQueryData,
  serviceMock,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

const SESSION_ID = 'ses_messages';

/** Texto del estado de error por defecto de `EmptyScreenError`. */
const ERROR_TEXT = 'Ocurrió un error al cargar los datos';

/**
 * Las cuatro secciones sin estado propio, con su pestaña, su texto de vacío
 * (contract §5) y un fragmento de contenido del camino feliz.
 */
interface TSectionCase {
  readonly tab: string;
  readonly empty: string;
  readonly content: string;
}

const SECTIONS: readonly TSectionCase[] = [
  {
    tab: 'Subagentes',
    empty: 'Sin subagentes ni agentes en paralelo.',
    content: 'Delegar revisión',
  },
  {
    tab: 'Herramientas',
    empty: 'Sin actividad de herramientas todavía.',
    content: 'read',
  },
  {
    tab: 'Respuestas',
    empty: 'Sin respuestas todavía',
    content: 'Respuesta final del agente',
  },
  {
    tab: 'Errores',
    empty: 'Sin errores.',
    content: 'no such file or directory',
  },
];

/** Nodo mínimo del grafo con identidad propia. */
const buildNode = (sessionId: string): TGraphNode => ({
  id: sessionId,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId,
    title: 'Tarea con mensajes',
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo',
    model: { providerID: 'opencode-go', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 0,
      startedAt: 0,
      endedAt: 0,
      cost: 0,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
  },
});

type TAssistantPart = SessionMessageAssistant['content'][number];

/** Tool call completada con su nombre y un input identificable. */
const tool = (
  name: string,
  input: Record<string, JsonValue>,
  id = `tool-${name}`,
): TAssistantPart => ({
  type: 'tool',
  id,
  name,
  state: {
    status: 'completed',
    input,
    content: [{ type: 'text', text: 'ok' }],
  },
  time: { created: 1000, completed: 1500 },
});

/** Tool call fallida: alimenta la sección de Errores. */
const failedTool = (message: string): TAssistantPart => ({
  type: 'tool',
  id: 'tool-bash',
  name: 'bash',
  state: { status: 'error', input: {}, error: { type: 'api', message } },
  time: { created: 1000, completed: 1500 },
});

const textPart = (text: string): TAssistantPart => ({ type: 'text', text });

/** Mensaje asistente que cubre las cuatro derivaciones (tareas, tools, texto, errores). */
const richMessage = (): TSessionMessage => {
  const content: TAssistantPart[] = [
    textPart(SECTIONS[2].content),
    tool('subagent', { description: SECTIONS[0].content }, 'tool-subagent'),
    tool('read', { filePath: '/repo/contrato.md' }),
    failedTool(SECTIONS[3].content),
  ];
  return {
    info: {
      id: 'assistant-1',
      time: { created: 1000, completed: 2000 },
      type: 'assistant',
      agent: 'develop',
      model: { providerID: 'opencode-go', id: 'deepseek' },
      content,
    },
    parts: content,
  };
};

/** Promesa bajo control del test (estado `pending` → resolución acordada). */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Diff vacío sembrado (no lo deja con valor por defecto `resetServiceMock`). */
const seedDiff = (client: QueryClient): void => {
  seedQueryData(client, queryKeys.sessions.diff(SESSION_ID), []);
};

/** Monta el panel real con el nodo de la sesión bajo prueba. */
const renderPanel = (client: QueryClient = createIntegrationQueryClient()) => {
  seedDiff(client);
  return renderWithProviders(<InspectorPanel node={buildNode(SESSION_ID)} />, {
    queryClient: client,
  });
};

const getTab = (name: string): HTMLElement => screen.getByRole('tab', { name });

/** Panel activo (los otros seis quedan `hidden` y Radix no monta sus hijos). */
const getActivePanel = (): HTMLElement => screen.getByRole('tabpanel');

/** Espera a que `tab` quede seleccionada y devuelve su panel activo. */
const openTab = async (
  user: ReturnType<typeof setupRadixUser>,
  name: string,
): Promise<HTMLElement> => {
  await user.click(getTab(name));
  await waitFor(() =>
    expect(getTab(name)).toHaveAttribute('aria-selected', 'true'),
  );
  return getActivePanel();
};

/**
 * Ninguno de los cuatro textos de vacío aparece **dentro del panel activo**
 * (SC-005). Se acota al panel: el resumen continuo (`ToolStats`) comparte
 * literal con la sección de Herramientas y no forma parte de las cuatro.
 */
const expectNoEmptyTexts = (panel: HTMLElement): void => {
  for (const { empty } of SECTIONS) {
    expect(within(panel).queryByText(empty)).not.toBeInTheDocument();
  }
};

beforeEach(() => {
  resetServiceMock(serviceMock);
});

describe('InspectorPanel — estados de mensajes en las cuatro secciones (FR-008/SC-005)', () => {
  it('con la consulta pendiente muestra carga y nunca el vacío en las cuatro', async () => {
    const user = setupRadixUser();
    // Consulta que nunca resuelve: la fuente queda en vuelo indefinidamente.
    serviceMock.getSessionMessages.mockReturnValue(new Promise(() => {}));

    renderPanel();

    for (const { tab } of SECTIONS) {
      const panel = await openTab(user, tab);
      expect(panel.querySelector('.animate-pulse')).toBeInTheDocument();
      expectNoEmptyTexts(panel);
    }
  });

  it('con mensajes sembrados muestra los listados reales de las cuatro', async () => {
    const user = setupRadixUser();
    const client = createIntegrationQueryClient();
    seedMessages(client, { [SESSION_ID]: [richMessage()] });
    seedDiff(client);

    renderPanel(client);
    expect(screen.queryAllByText('Ocurrió un error al cargar los datos')).toHaveLength(0);

    for (const { tab, content, empty } of SECTIONS) {
      const panel = await openTab(user, tab);
      expect(await within(panel).findByText(content)).toBeInTheDocument();
      expect(within(panel).queryByText(empty)).not.toBeInTheDocument();
    }
  });

  it('con la sesión inexistente (404) las cuatro muestran error y nunca el vacío', async () => {
    const user = setupRadixUser();
    serviceMock.getSessionMessages.mockRejectedValue(
      new Error('Sesión no encontrada'),
    );

    renderPanel();

    for (const { tab } of SECTIONS) {
      const panel = await openTab(user, tab);
      expect(await within(panel).findByText(ERROR_TEXT)).toBeInTheDocument();
      expectNoEmptyTexts(panel);
    }
  });

  it('resuelta sin mensajes muestra el vacío legítimo (nunca antes de resolver)', async () => {
    const user = setupRadixUser();
    const pending = deferred<TSessionMessage[]>();
    serviceMock.getSessionMessages.mockReturnValue(pending.promise);

    renderPanel();

    // Antes de resolver: carga en Subagentes (pestaña inicial) y sin vacíos.
    expect(getActivePanel().querySelector('.animate-pulse')).toBeInTheDocument();
    expectNoEmptyTexts(getActivePanel());

    await act(async () => {
      pending.resolve([]);
      // Deja correr la microtarea de resolución antes del siguiente frame.
      await Promise.resolve();
    });

    for (const { tab, empty } of SECTIONS) {
      const panel = await openTab(user, tab);
      expect(await within(panel).findByText(empty)).toBeInTheDocument();
    }
  });
});
