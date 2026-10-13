import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  JsonValue,
  SessionMessageAssistant,
  SessionMessageInfo,
} from '@opencode/client';
import { STORE_KEY } from '@app/Application/Hooks/useGlobalStore';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  INSPECTOR_SECTION_PANEL_TEST_ID,
  INSPECTOR_SECTION_TABS_TEST_ID,
} from '../InspectorSectionTabs';
import {
  INSPECTOR_SECTION_TAB_ITEMS,
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
} from '../../Hooks/useInspectorSectionTabs';
import type { TFileChange } from '../../Inspector.entity';
import { InspectorPanel } from '../InspectorPanel';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';

/**
 * El panel lee las tareas del subagente desde los mensajes de la sesión
 * (`deriveTasks`), así que mockeamos el SDK para poder ejercer el bloque
 * `Subagentes` con tareas reales además de los peers por prop (T020).
 */
const service = vi.hoisted(() => ({
  getSessionMessages: vi.fn(),
  getMcpServers: vi.fn(),
  getSessionInstructions: vi.fn(),
  getSessionDiff: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  getSessionPermissions: vi.fn(),
  listSessionInbox: vi.fn(),
  getSessionContext: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: service,
}));

/**
 * Props con las que `InspectorPanel` construye cada sección del `Record`
 * (contrato §3: las secciones conservan **literalmente** sus props). Los stubs
 * reenvían al componente real para no perder el resto de la cobertura; solo se
 * registran las props con las que el panel las construye al activar su pestaña.
 */
const sectionProps = vi.hoisted(() => ({
  subagents: undefined as object | undefined,
  files: undefined as object | undefined,
  tools: undefined as object | undefined,
  answers: undefined as object | undefined,
  questions: undefined as object | undefined,
  errors: undefined as object | undefined,
  latency: undefined as object | undefined,
}));

/** Props recibidas por una sección, indexables para las aserciones del spec. */
const propsOf = (props: object | undefined): Record<string, unknown> =>
  (props ?? {}) as Record<string, unknown>;

vi.mock('../SubagentsSection', async (importOriginal) => {
  const { SubagentsSection, ...rest } =
    await importOriginal<typeof import('../SubagentsSection')>();
  return {
    ...rest,
    SubagentsSection: (props: ComponentProps<typeof SubagentsSection>) => {
      sectionProps.subagents = props;
      return <SubagentsSection {...props} />;
    },
  };
});

vi.mock('../FileChanges', async (importOriginal) => {
  const { FileChanges, ...rest } =
    await importOriginal<typeof import('../FileChanges')>();
  return {
    ...rest,
    FileChanges: (props: ComponentProps<typeof FileChanges>) => {
      sectionProps.files = props;
      return <FileChanges {...props} />;
    },
  };
});

vi.mock('../ToolHistory', async (importOriginal) => {
  const { ToolHistory, ...rest } =
    await importOriginal<typeof import('../ToolHistory')>();
  return {
    ...rest,
    ToolHistory: (props: ComponentProps<typeof ToolHistory>) => {
      sectionProps.tools = props;
      return <ToolHistory {...props} />;
    },
  };
});

vi.mock('../AnswersSection', async (importOriginal) => {
  const { AnswersSection, ...rest } =
    await importOriginal<typeof import('../AnswersSection')>();
  return {
    ...rest,
    AnswersSection: (props: ComponentProps<typeof AnswersSection>) => {
      sectionProps.answers = props;
      return (
        <>
          <AnswersSection {...props} />
          {/*
            La sección real solo invoca el render inyectado para episodios de
            compactación; el stub lo invoca siempre para comprobar que el panel
            inyecta un render vivo, conectado al contexto de su sesión (FR-035).
          */}
          {props.renderCompactionContext?.(props.sessionId ?? 'sesión')}
        </>
      );
    },
  };
});

vi.mock('../QuestionsSection', async (importOriginal) => {
  const { QuestionsSection, ...rest } =
    await importOriginal<typeof import('../QuestionsSection')>();
  return {
    ...rest,
    QuestionsSection: (props: ComponentProps<typeof QuestionsSection>) => {
      sectionProps.questions = props;
      return <QuestionsSection {...props} />;
    },
  };
});

vi.mock('../ErrorsSection', async (importOriginal) => {
  const { ErrorsSection, ...rest } =
    await importOriginal<typeof import('../ErrorsSection')>();
  return {
    ...rest,
    ErrorsSection: (props: ComponentProps<typeof ErrorsSection>) => {
      sectionProps.errors = props;
      return <ErrorsSection {...props} />;
    },
  };
});

vi.mock('../LatencySection', async (importOriginal) => {
  const { LatencySection, ...rest } =
    await importOriginal<typeof import('../LatencySection')>();
  return {
    ...rest,
    LatencySection: (props: ComponentProps<typeof LatencySection>) => {
      sectionProps.latency = props;
      return <LatencySection {...props} />;
    },
  };
});

const node: TGraphNode = {
  id: 'root',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: 'root',
    title: 'Tarea raíz',
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo/opencode-agent-viz',
    model: { providerID: 'opencode', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 3000,
      startedAt: 0,
      endedAt: 3000,
      cost: 0.02,
      tokens: null,
      invocations: 2,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
  },
};

/** Nodo con la serie de latencia ya enriquecida (FR-018..FR-023). */
const latencyNode: TGraphNode = {
  ...node,
  data: {
    ...node.data,
    context: {
      breakdown: {
        buckets: [],
        chars: 0,
        windowTokens: null,
        hasTokens: false,
      },
      window: {
        windowTokens: null,
        cacheRead: null,
        cacheWrite: null,
        hitRate: null,
        costPerKToken: null,
      },
      latency: {
        samples: [{ stepId: 's1', startedAt: 1000, ttftMs: 120, totalMs: 800 }],
        medianMs: 500,
        reference: 'node',
        anomalies: [
          {
            stepId: 's1',
            ratio: 1.6,
            direction: 'slow',
            referenceMs: 500,
            reference: 'node',
          },
        ],
      },
      provisional: false,
    },
  },
};

/** Otro nodo del grafo, para ejercer el cambio de selección. */
const childNode: TGraphNode = {
  ...node,
  id: 'child',
  data: {
    ...node.data,
    sessionId: 'child',
    title: 'Tarea hija',
    isRoot: false,
  },
};

/** Etiquetas literales de las siete pestañas, en orden (FR-001/FR-005). */
const SECTION_TAB_LABELS = [
  'Subagentes',
  'Archivos',
  'Herramientas',
  'Respuestas',
  'Preguntas y permisos',
  'Errores',
  'Latencia',
];

/**
 * Props que el contrato §3 obliga a reenviar literalmente a cada sección. Se
 * comprueba **presencia** (no igualdad exacta): las tareas que añadan estados
 * (`isLoading`/`isError`) no rompen este spec.
 */
const SECTION_PROP_KEYS: Record<keyof typeof sectionProps, string[]> = {
  subagents: ['tasks', 'parallelPeers'],
  files: ['changes', 'isError', 'isLoading'],
  tools: ['tools'],
  answers: [
    'entries',
    'showReasoning',
    'onToggleReasoning',
    'onOpenHistory',
    'sessionId',
    'renderCompactionContext',
  ],
  questions: [
    'permissions',
    'questions',
    'queuedTurns',
    'isError',
    'isLoading',
  ],
  errors: ['errors'],
  latency: [
    'latency',
    'threshold',
    'onThresholdChange',
    'isError',
    'isLoading',
  ],
};

/** `true` si `first` precede a `second` en el orden del DOM (FR-001, SC-003). */
const isBefore = (first: HTMLElement, second: HTMLElement): boolean =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

/** Tool call completado del SDK, con el nombre y el input indicados. */
const toolCall = (
  name: string,
  input: Record<string, JsonValue>,
): SessionMessageAssistant['content'][number] => ({
  type: 'tool',
  id: `tool-${name}`,
  name,
  state: {
    status: 'completed',
    input,
    content: [{ type: 'text', text: 'ok' }],
  },
  time: { created: 1000, completed: 1500 },
});

/** Tool call `subagent` que `deriveTasks` traduce a una tarea del subagente. */
const subagentTool = (
  description: string,
): SessionMessageAssistant['content'][number] =>
  toolCall('subagent', { description });

/** Mensaje asistente con el contenido indicado, envolviendo `parts` como el SDK. */
const assistantMessage = (
  content: SessionMessageAssistant['content'],
): TSessionMessage => ({
  info: {
    id: 'assistant-1',
    time: { created: 1000, completed: 2000 },
    type: 'assistant',
    agent: 'develop',
    model: { providerID: 'opencode', id: 'deepseek' },
    content,
  },
  parts: content,
});

/** Mensaje asistente con una tarea delegada a un subagente. */
const taskMessage = (description: string): TSessionMessage =>
  assistantMessage([subagentTool(description)]);

/** Otro agente del mismo grupo de paralelismo que `node`. */
const peerNode = (id: string, title: string): TGraphNode => ({
  ...node,
  id,
  data: { ...node.data, sessionId: id, title, isRoot: false },
});

/** Cambio de archivo del diff de la sesión (FR-028..FR-030). */
const fileChange = (overrides: Partial<TFileChange> = {}): TFileChange => ({
  file: 'src/a.ts',
  patch: '@@ -1 +1 @@\n-old\n+new',
  additions: 1,
  deletions: 1,
  status: 'modified',
  ...overrides,
});

/** Mensaje del contexto resultante de una compactación (`session.context`). */
const compactionContextMessage: SessionMessageInfo = {
  id: 'ctx-1',
  time: { created: 5 },
  type: 'user',
  text: 'resumen previo',
};

type RadixUser = ReturnType<typeof setupRadixUser>;

/** Activa una pestaña del tablist interno y espera a que quede seleccionada. */
const clickTab = async (user: RadixUser, label: string): Promise<void> => {
  await user.click(screen.getByRole('tab', { name: label }));
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute(
      'aria-selected',
      'true',
    ),
  );
};

/** Tablist de secciones técnicas del detalle (el interno, FR-013). */
const getTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INSPECTOR_SECTION_TABS_ARIA_LABEL });

/** Todos los paneles del tablist interno; los inactivos llegan `hidden`. */
const getPanels = (): HTMLElement[] =>
  screen.getAllByRole('tabpanel', { hidden: true });

beforeEach(() => {
  service.getSessionMessages.mockResolvedValue([]);
  service.getMcpServers.mockResolvedValue([]);
  service.getSessionInstructions.mockResolvedValue([]);
  service.getSessionDiff.mockResolvedValue([]);
  service.listSessionForms.mockResolvedValue([]);
  service.getSessionPermissions.mockResolvedValue([]);
  service.listSessionInbox.mockResolvedValue([]);
  service.getSessionContext.mockResolvedValue([]);

  for (const key of Object.keys(
    sectionProps,
  ) as (keyof typeof sectionProps)[]) {
    sectionProps[key] = undefined;
  }
});

describe('InspectorPanel', () => {
  it('prompts to select a node when none is provided', () => {
    renderWithProviders(<InspectorPanel node={null} />);
    expect(
      screen.getByText('Selecciona un nodo del grafo para ver su detalle.'),
    ).toBeInTheDocument();
    // Sin nodo no hay detalle: ningún tablist (contract §4).
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
  });

  it('renders the agent identity and the model data for a selected node', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
  });

  it('orders the continuous summary and closes it with the section tablist (FR-004, FR-009)', () => {
    const { container } = renderWithProviders(<InspectorPanel node={node} />);

    const identity = screen.getByText('Tarea raíz');
    const model = screen.getByText('Modelo');
    const metrics = screen.getByText('Métricas');
    // Contexto permanece en el resumen continuo (contract §1).
    const context = screen.getByText('Contexto');
    const resources = screen.getByText('Recursos');
    const toolStats = screen.getByText('Duración mediana por herramienta');
    const tablist = getTablist();

    expect(isBefore(identity, model)).toBe(true);
    expect(isBefore(model, metrics)).toBe(true);
    expect(isBefore(metrics, context)).toBe(true);
    expect(isBefore(context, resources)).toBe(true);
    expect(isBefore(resources, toolStats)).toBe(true);
    expect(isBefore(toolStats, tablist)).toBe(true);

    // El tablist es el último bloque del eje vertical.
    expect(container.firstElementChild?.lastElementChild).toContainElement(
      tablist,
    );
  });

  it('keeps the identity header above the ordered sections (FR-002)', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    expect(
      isBefore(screen.getByText('Tarea raíz'), screen.getByText('Modelo')),
    ).toBe(true);
  });

  it('renders the Loop warning inside the Métricas section (FR-004)', () => {
    const loopingNode: TGraphNode = {
      ...node,
      data: {
        ...node.data,
        metrics: {
          ...node.data.metrics,
          retryCount: 2,
          hasLoop: true,
          loopEvidence: ['reintentos repetidos de bash'],
        },
      },
    };

    renderWithProviders(<InspectorPanel node={loopingNode} />);

    const metricsSection = screen.getByText('Métricas')
      .parentElement as HTMLElement;

    // El aviso forma parte de la sección Métricas, no es una sección suelta.
    expect(
      within(metricsSection).getByText(/Posible loop/),
    ).toBeInTheDocument();
  });

  it('shows the model variant as "Razonamiento"', () => {
    const withVariant: TGraphNode = {
      ...node,
      data: {
        ...node.data,
        model: {
          providerID: 'opencode-go',
          id: 'deepseek-v4.1-flash',
          variant: 'high',
        },
      },
    };

    renderWithProviders(<InspectorPanel node={withVariant} />);

    expect(
      screen.getByText('opencode-go/deepseek-v4.1-flash'),
    ).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // US3 — resumen continuo y tablist de secciones técnicas
  // (FR-001..FR-005, FR-009..FR-014, SC-002/SC-003, contract §1-§3)
  // ---------------------------------------------------------------------------

  it('retires the "Avanzado" disclosure: no aria-expanded nor role="region" (FR-010, SC-002)', () => {
    const { container } = renderWithProviders(<InspectorPanel node={node} />);

    expect(
      screen.queryByRole('button', { name: 'Avanzado' }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="region"]')).toHaveLength(0);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('renders the seven section tabs, in order, under its own aria-label (FR-001, FR-005)', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    const tablist = getTablist();

    expect(tablist).toHaveAttribute(
      'data-testid',
      INSPECTOR_SECTION_TABS_TEST_ID,
    );
    expect(tablist).toHaveAttribute('data-orientation', 'horizontal');

    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    expect(tabs.map((tab) => tab.textContent)).toEqual(SECTION_TAB_LABELS);
    // Las etiquetas del spec son las de la constante centralizada (FR-005).
    expect(SECTION_TAB_LABELS).toEqual(
      INSPECTOR_SECTION_TAB_ITEMS.map((item) => item.label),
    );

    // Una sola activa y por defecto la primera (FR-003).
    expect(
      tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    for (const tab of tabs) expect(tab).not.toHaveAttribute('aria-expanded');
  });

  it('mounts only the active panel and leaves the other six hidden and empty (FR-002)', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    const panels = getPanels();
    expect(panels).toHaveLength(7);
    for (const panel of panels) {
      expect(panel).toHaveAttribute(
        'data-testid',
        INSPECTOR_SECTION_PANEL_TEST_ID,
      );
    }

    const hidden = panels.filter((panel) => panel.hasAttribute('hidden'));
    expect(hidden).toHaveLength(6);
    for (const panel of hidden) expect(panel).toBeEmptyDOMElement();

    // La sección activa (Subagentes) sí está montada.
    expect(
      within(screen.getByRole('tabpanel')).getByText('Subagentes'),
    ).toBeInTheDocument();
  });

  it('switches sections with the tablist without duplicating the summary (SC-003)', async () => {
    const user = setupRadixUser();
    service.getSessionMessages.mockResolvedValue([
      assistantMessage([toolCall('bash', { command: 'pnpm test' })]),
    ]);
    service.getSessionDiff.mockResolvedValue([
      fileChange({ file: 'src/a.ts' }),
    ]);

    renderWithProviders(<InspectorPanel node={node} />);

    // Las secciones técnicas no invaden el resumen: solo existen como pestañas.
    for (const label of SECTION_TAB_LABELS.filter(
      (label) => label !== 'Subagentes',
    )) {
      expect(screen.getAllByText(label)).toHaveLength(1);
    }

    await clickTab(user, 'Herramientas');

    const toolsPanel = screen.getByRole('tabpanel');
    expect(within(toolsPanel).getByText('Herramientas')).toBeInTheDocument();
    expect(await within(toolsPanel).findByText('bash')).toBeInTheDocument();
    // El resumen sigue fuera del panel y sin duplicarse.
    expect(within(toolsPanel).queryByText('Métricas')).not.toBeInTheDocument();
    expect(screen.getAllByText('Métricas')).toHaveLength(1);

    await clickTab(user, 'Archivos');

    const filesPanel = screen.getByRole('tabpanel');
    expect(await within(filesPanel).findByText('src/a.ts')).toBeInTheDocument();
    expect(within(filesPanel).queryByText('bash')).not.toBeInTheDocument();
    expect(
      getPanels().filter((panel) => panel.hasAttribute('hidden')),
    ).toHaveLength(6);
  });

  it('builds each section with its literal props when its tab activates (contract §3)', async () => {
    const user = setupRadixUser();
    const onOpenHistory = vi.fn();
    const peers = [peerNode('peer-1', 'Agente hermano')];
    const diffChanges = [fileChange({ file: 'src/a.ts' })];

    service.getSessionMessages.mockResolvedValue([
      taskMessage('Revisar contrato'),
    ]);
    service.getSessionDiff.mockResolvedValue(diffChanges);

    renderWithProviders(
      <InspectorPanel
        node={node}
        parallelPeers={peers}
        onOpenHistory={onOpenHistory}
      />,
    );

    await clickTab(user, 'Subagentes');
    expect(propsOf(sectionProps.subagents)).toMatchObject({
      parallelPeers: peers,
    });
    await waitFor(() =>
      expect(propsOf(sectionProps.subagents).tasks).toHaveLength(1),
    );

    await clickTab(user, 'Archivos');
    await waitFor(() =>
      expect(propsOf(sectionProps.files).changes).toBe(diffChanges),
    );

    await clickTab(user, 'Herramientas');
    await waitFor(() =>
      expect(propsOf(sectionProps.tools).tools).toHaveLength(1),
    );

    await clickTab(user, 'Respuestas');
    expect(propsOf(sectionProps.answers).showReasoning).toBe(false);
    expect(propsOf(sectionProps.answers).onOpenHistory).toBe(onOpenHistory);
    expect(propsOf(sectionProps.answers).renderCompactionContext).toBeTypeOf(
      'function',
    );
    expect(propsOf(sectionProps.answers).entries).toEqual(expect.any(Array));

    await clickTab(user, 'Preguntas y permisos');
    expect(propsOf(sectionProps.questions).queuedTurns).toBe(0);

    await clickTab(user, 'Errores');
    expect(propsOf(sectionProps.errors).errors).toEqual([]);

    await clickTab(user, 'Latencia');
    expect(propsOf(sectionProps.latency).latency).toBeNull();

    for (const [section, keys] of Object.entries(SECTION_PROP_KEYS)) {
      for (const key of keys) {
        expect(
          propsOf(sectionProps[section as keyof typeof sectionProps]),
        ).toHaveProperty(key);
      }
    }
  });

  it('forwards the node sessionId to Respuestas and follows the node change (FR-014)', async () => {
    const user = setupRadixUser();
    const { rerender } = renderWithProviders(<InspectorPanel node={node} />);

    await clickTab(user, 'Respuestas');
    expect(propsOf(sectionProps.answers).sessionId).toBe('root');

    // Cambiar de nodo sin desmontar el panel conserva la pestaña activa.
    rerender(<InspectorPanel node={childNode} />);

    expect(propsOf(sectionProps.answers).sessionId).toBe('child');
    expect(screen.getByText('Tarea hija')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Respuestas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('injects a live compaction context render into Respuestas (FR-014)', async () => {
    const user = setupRadixUser();
    service.getSessionContext.mockResolvedValue([compactionContextMessage]);

    renderWithProviders(<InspectorPanel node={node} />);

    await clickTab(user, 'Respuestas');

    const panel = screen.getByRole('tabpanel');
    expect(
      await within(panel).findByTestId('compaction-context'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Contexto resultante')).toBeInTheDocument();
    expect(within(panel).getByText('resumen previo')).toBeInTheDocument();
    // El render inyectado pide el contexto de la sesión del nodo.
    expect(service.getSessionContext).toHaveBeenCalledWith('root');
  });

  it('keeps the answers wiring (Respuestas, razonamiento, histórico) inside its tab (FR-014)', async () => {
    const user = setupRadixUser();
    renderWithProviders(<InspectorPanel node={node} />);

    await clickTab(user, 'Respuestas');

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Respuestas')).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: /razonamiento/i }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: 'Ver histórico completo' }),
    ).toBeInTheDocument();
  });

  it('keeps the measured answers, anomalies and threshold in the Latencia tab (FR-018..FR-023)', async () => {
    const user = setupRadixUser();
    renderWithProviders(<InspectorPanel node={latencyNode} />);

    // La latencia no vive en el resumen continuo ni en las otras pestañas.
    expect(screen.queryByTestId('latency-section')).not.toBeInTheDocument();
    expect(screen.queryByText('Anomalías')).not.toBeInTheDocument();

    await clickTab(user, 'Latencia');

    const latency = await screen.findByTestId('latency-section');
    expect(latency).toHaveTextContent('Latencia');
    expect(within(latency).getByText('Respuestas')).toBeInTheDocument();
    expect(within(latency).getByText('Anomalías')).toBeInTheDocument();
    expect(within(latency).getByText('Umbral de anomalía')).toBeInTheDocument();
  });

  it('wires the anomaly threshold of Latencia to the shared store (FR-022)', async () => {
    const user = setupRadixUser();
    const { queryClient } = renderWithProviders(
      <InspectorPanel node={latencyNode} />,
      {
        seed: (client) =>
          client.setQueryData([STORE_KEY.anomalyThreshold], 0.4),
      },
    );

    await clickTab(user, 'Latencia');

    // El umbral llega por prop desde el store (no se inventa en el panel).
    expect(propsOf(sectionProps.latency)).toMatchObject({ threshold: 0.4 });
    const control = await screen.findByLabelText('Umbral de anomalía ±40%');

    fireEvent.change(control, { target: { value: '60' } });

    await waitFor(() =>
      expect(queryClient.getQueryData([STORE_KEY.anomalyThreshold])).toBe(0.6),
    );
    expect(
      screen.getByLabelText('Umbral de anomalía ±60%'),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // US3 — "Subagentes" agrupa tareas y paralelismo (FR-007/FR-008, T020)
  // ---------------------------------------------------------------------------

  it('groups parallel peers and subagent tasks under a single "Subagentes" header (FR-007, T020)', async () => {
    service.getSessionMessages.mockResolvedValue([
      taskMessage('Revisar contrato'),
    ]);

    renderWithProviders(
      <InspectorPanel
        node={node}
        parallelPeers={[peerNode('peer-1', 'Agente hermano')]}
      />,
    );

    await screen.findByText('Revisar contrato');

    // Un único encabezado en la sección activa: ni "En paralelo (N)" ni
    // "Tareas del subagente".
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByText('Subagentes')).toHaveLength(1);
    expect(screen.queryByText(/^En paralelo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tareas del subagente')).not.toBeInTheDocument();

    const block = within(panel).getByText('Subagentes')
      .parentElement as HTMLElement;
    const task = within(block).getByText('Revisar contrato');
    const peer = within(block).getByText('Agente hermano');

    expect(task).toBeInTheDocument();
    expect(peer).toBeInTheDocument();
    // Las tareas se listan antes que los peers (contrato 3.3).
    expect(isBefore(task, peer)).toBe(true);
    expect(
      within(block).queryByText('Sin subagentes ni agentes en paralelo.'),
    ).not.toBeInTheDocument();
  });

  it('shows the explicit empty state when there are no tasks nor peers (FR-008, T020)', async () => {
    renderWithProviders(<InspectorPanel node={node} />);

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByText('Subagentes')).toHaveLength(1);
    expect(
      await within(panel).findByText('Sin subagentes ni agentes en paralelo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^En paralelo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tareas del subagente')).not.toBeInTheDocument();
  });
});
