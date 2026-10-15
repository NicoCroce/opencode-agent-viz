/**
 * U24 (T014) — E2E de frontera **U4↔U3**: `Record` de secciones y props literales.
 *
 * Monta el `InspectorPanel` **real** (no el marcador del arnés) con
 * `renderWithProviders` + `createIntegrationQueryClient` y el SDK mockeado por
 * el arnés (`serviceMock`/`resetServiceMock`), sembrando la caché que alimenta
 * el mapa de secciones:
 *
 * - mensajes (`sessions.messages(id)`) → tareas, herramientas y errores;
 * - diff (`sessions.diff(id)`) → archivos;
 * - preguntas resueltas + permisos por sesión + inbox → Preguntas y permisos;
 * - preferencia de umbral en el store global → Latencia;
 * - `node.data.context.latency` → serie de latencia.
 *
 * Las **siete hojas** del `Record<TInspectorSectionTab, ReactNode>` se
 * sustituyen por marcadores que exponen sus props en `data-*`: es la frontera
 * U4↔U3 (el panel entrega las siete entradas; las secciones las consumen), así
 * que se ejerce la caja del panel **entera** sin depender de la presentación
 * interna de cada sección. El resumen continuo se conserva real.
 *
 * Cubre `contracts/inspector-section-tabs-contract.md` §1/§3 y `data-model.md`
 * §1/§5:
 *
 * 1. **Exhaustividad + una sola a la vez**: al recorrer las siete pestañas
 *    aparece cada entrada del mapa, exactamente una por turno.
 * 2. **Props literales**: cada sección recibe los valores de la caché, del nodo
 *    y del llamador tal cual (peers, sessionId, showReasoning, umbral,
 *    handlers), sin transformarlos ni inventarlos.
 * 3. **Caso negativo (dato inexistente)**: `node = null` ⇒ ninguna sección,
 *    ningún `role="tablist"` y ningún error de render.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import type {
  TGraphNode,
  TLatencyReport,
} from '@app/Domains/Graph/Graph.entity';
import {
  INSPECTOR_SECTION_TAB_ITEMS,
  type TInspectorSectionTab,
} from '@app/Domains/Inspector/Hooks/useInspectorSectionTabs';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import { STORE_KEY } from '@app/Application/Hooks';
import { queryKeys } from '@app/Domains/queryKeys';
import { latencyReport, latencySample } from '@app/test/latencyFixtures';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  seedForms,
  seedMessages,
  seedPermissions,
  seedQueryData,
  serviceMock,
} from './harness';

/* -------------------------------------------------------------------------- */
/* Marcadores de la frontera U4↔U3                                              */
/* -------------------------------------------------------------------------- */

/** `data-testid` de cada hoja del `Record` (una por pestaña). */
const { SECTION_TEST_ID } = vi.hoisted(() => ({
  SECTION_TEST_ID: {
    subagents: 'section-record-subagents',
    files: 'section-record-files',
    tools: 'section-record-tools',
    answers: 'section-record-answers',
    questions: 'section-record-questions',
    errors: 'section-record-errors',
    latency: 'section-record-latency',
  } as const,
}));

interface TSubagentsMarkerProps {
  tasks: { description: string }[];
  parallelPeers: TGraphNode[];
}

interface TFilesMarkerProps {
  changes: { file: string }[];
}

interface TToolsMarkerProps {
  tools: { name: string }[];
}

interface TAnswersMarkerProps {
  showReasoning: boolean;
  onToggleReasoning: () => void;
  onOpenHistory?: () => void;
  sessionId?: string | null;
  renderCompactionContext?: (...args: unknown[]) => unknown;
}

interface TQuestionsMarkerProps {
  permissions: unknown[];
  questions: unknown[];
  queuedTurns: number;
}

interface TErrorsMarkerProps {
  errors: { message: string; at: number }[];
}

interface TLatencyMarkerProps {
  latency: TLatencyReport | null;
  threshold: number;
  onThresholdChange: (value: number) => void;
}

vi.mock(
  '@app/Domains/Inspector/Components/SubagentsSection',
  () => ({
    SubagentsSection: ({ tasks, parallelPeers }: TSubagentsMarkerProps) => (
      <div
        data-testid={SECTION_TEST_ID.subagents}
        data-section="subagents"
        data-task-count={tasks.length}
        data-task-descriptions={tasks.map((task) => task.description).join('|')}
        data-peer-count={parallelPeers.length}
        data-peer-titles={parallelPeers
          .map((peer) => peer.data.title ?? peer.data.agentName)
          .join('|')}
      />
    ),
  }),
);

vi.mock('@app/Domains/Inspector/Components/FileChanges', () => ({
  FileChanges: ({ changes }: TFilesMarkerProps) => (
    <div
      data-testid={SECTION_TEST_ID.files}
      data-section="files"
      data-change-count={changes.length}
      data-change-files={changes.map((change) => change.file).join('|')}
    />
  ),
}));

vi.mock('@app/Domains/Inspector/Components/ToolHistory', () => ({
  ToolHistory: ({ tools }: TToolsMarkerProps) => (
    <div
      data-testid={SECTION_TEST_ID.tools}
      data-section="tools"
      data-tool-count={tools.length}
      data-tool-names={tools.map((tool) => tool.name).join('|')}
    />
  ),
}));

vi.mock('@app/Domains/Inspector/Components/AnswersSection', () => ({
  AnswersSection: ({
    showReasoning,
    onToggleReasoning,
    onOpenHistory,
    sessionId,
    renderCompactionContext,
  }: TAnswersMarkerProps) => (
    <div
      data-testid={SECTION_TEST_ID.answers}
      data-section="answers"
      data-session-id={sessionId ?? ''}
      data-show-reasoning={String(showReasoning)}
      data-has-compaction={String(typeof renderCompactionContext === 'function')}
    >
      <button type="button" onClick={() => onToggleReasoning()}>
        Alternar razonamiento
      </button>
      <button type="button" onClick={() => onOpenHistory?.()}>
        Abrir histórico
      </button>
    </div>
  ),
}));

vi.mock('@app/Domains/Inspector/Components/QuestionsSection', () => ({
  QuestionsSection: ({
    permissions,
    questions,
    queuedTurns,
  }: TQuestionsMarkerProps) => (
    <div
      data-testid={SECTION_TEST_ID.questions}
      data-section="questions"
      data-permission-count={permissions.length}
      data-question-count={questions.length}
      data-queued-turns={queuedTurns}
    />
  ),
}));

vi.mock('@app/Domains/Inspector/Components/ErrorsSection', () => ({
  ErrorsSection: ({ errors }: TErrorsMarkerProps) => (
    <div
      data-testid={SECTION_TEST_ID.errors}
      data-section="errors"
      data-error-count={errors.length}
      data-error-messages={errors.map((error) => error.message).join('|')}
    />
  ),
}));

vi.mock('@app/Domains/Inspector/Components/LatencySection', () => ({
  LatencySection: ({
    latency,
    threshold,
    onThresholdChange,
  }: TLatencyMarkerProps) => (
    <div
      data-testid={SECTION_TEST_ID.latency}
      data-section="latency"
      data-sample-count={latency?.samples.length ?? 0}
      data-threshold={String(threshold)}
    >
      <button type="button" onClick={() => onThresholdChange(0.5)}>
        Cambiar umbral
      </button>
    </div>
  ),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */
/* -------------------------------------------------------------------------- */

const SESSION_ID = 'ses_record';

/** Etiqueta literal de cada pestaña (contract §1), indexada por id. */
const LABEL_BY_TAB = Object.fromEntries(
  INSPECTOR_SECTION_TAB_ITEMS.map((item) => [item.id, item.label]),
) as Record<TInspectorSectionTab, string>;

const DIFF_CHANGES = [
  {
    file: 'src/a.ts',
    patch: '',
    additions: 2,
    deletions: 1,
    status: 'modified' as const,
  },
  {
    file: 'src/b.ts',
    patch: '',
    additions: 0,
    deletions: 3,
    status: 'deleted' as const,
  },
];

const RAW_PERMISSIONS = [
  {
    id: 'perm-1',
    sessionID: SESSION_ID,
    action: 'edit',
    resources: ['src/a.ts'],
  },
];

/** Inbox con dos turnos en cola y uno `steer` (no cuenta como cola). */
const INBOX = [
  {
    id: 'inbox-1',
    sessionID: SESSION_ID,
    time: { created: 1 },
    type: 'user' as const,
    payload: { text: 'turno 1' },
    delivery: 'queue' as const,
  },
  {
    id: 'inbox-2',
    sessionID: SESSION_ID,
    time: { created: 2 },
    type: 'user' as const,
    payload: { text: 'turno 2' },
    delivery: 'queue' as const,
  },
  {
    id: 'inbox-3',
    sessionID: SESSION_ID,
    time: { created: 3 },
    type: 'user' as const,
    payload: { text: 'turno 3' },
    delivery: 'steer' as const,
  },
];

const QUESTION_ENTRIES: TQuestionEntry[] = [
  {
    id: 'q-1',
    title: '¿Continuar?',
    fields: [],
    state: 'pending',
    answer: null,
  },
];

const LATENCY_REPORT: TLatencyReport = latencyReport({
  samples: [
    latencySample({ stepId: 's1', startedAt: 1000, generationMs: 120, totalMs: 800 }),
    latencySample({ stepId: 's2', startedAt: 2000, generationMs: 150, totalMs: 900 }),
  ],
});

/** Umbral literal sembrado en el store global (`useAnomalyThreshold`). */
const SEEDED_THRESHOLD = 0.25;
/** Umbral que disparan los marcadores para probar el wiring del handler. */
const NEXT_THRESHOLD = 0.5;

/** Tool call `subagent` que `deriveTasks` traduce a una tarea delegada. */
const subagentPart = (
  description: string,
): SessionMessageAssistant['content'][number] => ({
  type: 'tool',
  id: 'tool-subagent',
  name: 'subagent',
  state: {
    status: 'completed',
    input: { description },
    content: [{ type: 'text', text: 'ok' }],
  },
  time: { created: 1000, completed: 1500 },
});

/** Tool call completado que `toolsFromMessages` cuenta como herramienta. */
const bashPart = (): SessionMessageAssistant['content'][number] => ({
  type: 'tool',
  id: 'tool-bash',
  name: 'bash',
  state: {
    status: 'completed',
    input: { command: 'ls' },
    content: [{ type: 'text', text: 'ok' }],
  },
  time: { created: 1600, completed: 1700 },
});

/** Tool call fallido que `errorsFromMessages` traduce a un error. */
const errorPart = (
  message: string,
): SessionMessageAssistant['content'][number] => ({
  type: 'tool',
  id: 'tool-guard',
  name: 'guard',
  state: {
    status: 'error',
    input: {},
    error: { type: 'error', message },
  },
  time: { created: 1800, completed: 1900 },
});

/** Mensaje asistente que alimenta tareas (1), herramientas (3) y errores (1). */
const assistantMessage = (): TSessionMessage => {
  const content = [
    subagentPart('Delegar revisión'),
    bashPart(),
    errorPart('Fallo al escribir'),
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

/** Nodo mínimo del grafo con identidad y serie de latencia distinguibles. */
const buildNode = (title: string): TGraphNode => ({
  id: SESSION_ID,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: SESSION_ID,
    title,
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
    context: {
      breakdown: { buckets: [], chars: 0, windowTokens: null, hasTokens: false },
      window: {
        windowTokens: null,
        cacheRead: null,
        cacheWrite: null,
        hitRate: null,
        costPerKToken: null,
      },
      latency: LATENCY_REPORT,
      provisional: false,
    },
  },
});

const PEERS: TGraphNode[] = [
  {
    ...buildNode('Padre'),
    id: 'peer-parent',
    data: { ...buildNode('Padre').data, sessionId: 'ses_parent', isRoot: false },
  },
  {
    ...buildNode('Hermano'),
    id: 'peer-sibling',
    data: {
      ...buildNode('Hermano').data,
      sessionId: 'ses_sibling',
      isRoot: false,
    },
  },
];

/**
 * Siembra la caché que el panel lee para construir las siete entradas del mapa,
 * más el umbral de latencia en el store global.
 */
const seedPanelCache = (client: QueryClient): void => {
  seedMessages(client, { [SESSION_ID]: [assistantMessage()] });
  seedQueryData(client, queryKeys.sessions.diff(SESSION_ID), DIFF_CHANGES);
  seedQueryData(client, queryKeys.sessions.inbox(SESSION_ID), INBOX);
  seedPermissions(client, RAW_PERMISSIONS, {
    bySession: { [SESSION_ID]: RAW_PERMISSIONS },
  });
  seedForms(client, { questions: { [SESSION_ID]: QUESTION_ENTRIES } });
  seedQueryData(client, [STORE_KEY.anomalyThreshold], SEEDED_THRESHOLD);
};

const getTab = (id: TInspectorSectionTab): HTMLElement =>
  screen.getByRole('tab', { name: LABEL_BY_TAB[id] });

const getActivePanel = (): HTMLElement => screen.getByRole('tabpanel');

/** Props del panel real, para tipar los extras de cada caso. */
type TPanelProps = ComponentProps<typeof InspectorPanel>;

/** Monta el panel real con un nodo y la caché sembrada antes del render. */
const renderPanel = (
  node: TGraphNode | null,
  extraProps: Partial<TPanelProps> = {},
) =>
  renderWithProviders(<InspectorPanel node={node} {...extraProps} />, {
    queryClient: createIntegrationQueryClient(),
    seed: seedPanelCache,
  });

beforeEach(() => {
  resetServiceMock(serviceMock);
  globalThis.localStorage?.clear();
});

describe('InspectorPanel — Record de secciones y props literales (§1/§3, U4↔U3)', () => {
  it('expone las siete entradas del Record y monta una sola sección por turno', async () => {
    const user = setupRadixUser();
    renderPanel(buildNode('Tarea U24'));

    // El tablist interno es el único del panel (el externo vive en InspectorPane).
    const tablist = screen.getByRole('tablist', {
      name: 'Secciones técnicas del nodo',
    });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(7);

    const visited: TInspectorSectionTab[] = [];

    for (const item of INSPECTOR_SECTION_TAB_ITEMS) {
      await user.click(getTab(item.id));
      await waitFor(() =>
        expect(getTab(item.id)).toHaveAttribute('aria-selected', 'true'),
      );

      // La entrada del mapa en turno monta su sección…
      const marker = within(getActivePanel()).getByTestId(
        SECTION_TEST_ID[item.id],
      );
      expect(marker).toHaveAttribute('data-section', item.id);
      visited.push(item.id);

      // …y ninguna otra (las seis restantes quedan `hidden` y sin hijos).
      for (const other of INSPECTOR_SECTION_TAB_ITEMS) {
        if (other.id === item.id) continue;
        expect(
          screen.queryByTestId(SECTION_TEST_ID[other.id]),
        ).not.toBeInTheDocument();
      }

      // Un solo panel visible entre los siete montados por Radix.
      expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(7);
    }

    // Las siete entradas existen: recorrer las pestañas las visita todas.
    expect([...new Set(visited)]).toEqual(
      INSPECTOR_SECTION_TAB_ITEMS.map((item) => item.id),
    );
  });

  it('entrega a cada sección sus props literales (caché, nodo y llamador)', async () => {
    const user = setupRadixUser();
    const onOpenHistory = vi.fn();
    const onToggleReasoning = vi.fn();

    renderPanel(buildNode('Tarea U24'), {
      parallelPeers: PEERS,
      showReasoning: true,
      onToggleReasoning,
      onOpenHistory,
    });

    // Subagentes: tareas derivadas de la caché + peers por prop literales.
    const subagents = screen.getByTestId(SECTION_TEST_ID.subagents);
    expect(subagents).toHaveAttribute('data-task-count', '1');
    expect(subagents).toHaveAttribute(
      'data-task-descriptions',
      'Delegar revisión',
    );
    expect(subagents).toHaveAttribute('data-peer-count', '2');
    expect(subagents).toHaveAttribute('data-peer-titles', 'Padre|Hermano');

    // Archivos: cambios del diff sembrado.
    await user.click(getTab('files'));
    await waitFor(() =>
      expect(getTab('files')).toHaveAttribute('aria-selected', 'true'),
    );
    const files = screen.getByTestId(SECTION_TEST_ID.files);
    expect(files).toHaveAttribute('data-change-count', '2');
    expect(files).toHaveAttribute('data-change-files', 'src/a.ts|src/b.ts');

    // Herramientas: tools derivadas de los mismos mensajes.
    await user.click(getTab('tools'));
    await waitFor(() =>
      expect(getTab('tools')).toHaveAttribute('aria-selected', 'true'),
    );
    const tools = screen.getByTestId(SECTION_TEST_ID.tools);
    expect(tools).toHaveAttribute('data-tool-count', '3');
    expect(tools).toHaveAttribute('data-tool-names', 'subagent|bash|guard');

    // Respuestas: sessionId, razonamiento controlado y handlers literales.
    await user.click(getTab('answers'));
    await waitFor(() =>
      expect(getTab('answers')).toHaveAttribute('aria-selected', 'true'),
    );
    const answers = screen.getByTestId(SECTION_TEST_ID.answers);
    expect(answers).toHaveAttribute('data-session-id', SESSION_ID);
    expect(answers).toHaveAttribute('data-show-reasoning', 'true');
    expect(answers).toHaveAttribute('data-has-compaction', 'true');

    const answersScope = within(answers);
    await user.click(answersScope.getByRole('button', { name: 'Abrir histórico' }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);

    await user.click(
      answersScope.getByRole('button', { name: 'Alternar razonamiento' }),
    );
    expect(onToggleReasoning).toHaveBeenCalledTimes(1);
    // Controlado: el llamador impone la visibilidad; el panel no la deriva.
    expect(answers).toHaveAttribute('data-show-reasoning', 'true');

    // Preguntas y permisos: permisos, preguntas y cola sembrados.
    await user.click(getTab('questions'));
    await waitFor(() =>
      expect(getTab('questions')).toHaveAttribute('aria-selected', 'true'),
    );
    const questions = screen.getByTestId(SECTION_TEST_ID.questions);
    expect(questions).toHaveAttribute('data-permission-count', '1');
    expect(questions).toHaveAttribute('data-question-count', '1');
    expect(questions).toHaveAttribute('data-queued-turns', '2');

    // Errores: mensaje del tool fallido.
    await user.click(getTab('errors'));
    await waitFor(() =>
      expect(getTab('errors')).toHaveAttribute('aria-selected', 'true'),
    );
    const errors = screen.getByTestId(SECTION_TEST_ID.errors);
    expect(errors).toHaveAttribute('data-error-count', '1');
    expect(errors).toHaveAttribute('data-error-messages', 'Fallo al escribir');

    // Latencia: serie del nodo + umbral del store, y el handler propaga.
    await user.click(getTab('latency'));
    await waitFor(() =>
      expect(getTab('latency')).toHaveAttribute('aria-selected', 'true'),
    );
    const latency = screen.getByTestId(SECTION_TEST_ID.latency);
    expect(latency).toHaveAttribute('data-sample-count', '2');
    expect(latency).toHaveAttribute('data-threshold', String(SEEDED_THRESHOLD));

    await user.click(
      within(latency).getByRole('button', { name: 'Cambiar umbral' }),
    );
    await waitFor(() =>
      expect(latency).toHaveAttribute('data-threshold', String(NEXT_THRESHOLD)),
    );
  });

  it('con node = null no monta ninguna sección, ni tablist, ni error de render', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderWithProviders(<InspectorPanel node={null} />, {
      queryClient: createIntegrationQueryClient(),
      seed: seedPanelCache,
    });

    expect(
      screen.getByText('Selecciona un nodo del grafo para ver su detalle.'),
    ).toBeInTheDocument();

    // Dato inexistente: el detalle no existe, así que no hay tablist ni paneles.
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
    expect(screen.queryAllByRole('tabpanel', { hidden: true })).toHaveLength(0);

    // Ni secciones huérfanas: ninguna de las siete hojas del Record se monta.
    for (const item of INSPECTOR_SECTION_TAB_ITEMS) {
      expect(
        screen.queryByTestId(SECTION_TEST_ID[item.id]),
      ).not.toBeInTheDocument();
      expect(container.textContent).not.toContain(LABEL_BY_TAB[item.id]);
    }

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
