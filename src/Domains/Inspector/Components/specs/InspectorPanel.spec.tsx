import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { STORE_KEY } from '@app/Application/Hooks';
import { renderWithProviders } from '@app/test/renderWithProviders';
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

/** `true` si `first` precede a `second` en el orden del DOM (FR-001, SC-003). */
const isBefore = (first: HTMLElement, second: HTMLElement): boolean =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

/** Tool call `subagent` que `deriveTasks` traduce a una tarea del subagente. */
const subagentTool = (
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

/** Mensaje asistente con una tarea delegada, envolviendo `parts` como el SDK. */
const taskMessage = (description: string): TSessionMessage => {
  const content = [subagentTool(description)];
  return {
    info: {
      id: 'assistant-1',
      time: { created: 1000, completed: 2000 },
      type: 'assistant',
      agent: 'develop',
      model: { providerID: 'opencode', id: 'deepseek' },
      content,
    },
    parts: content,
  };
};

/** Otro agente del mismo grupo de paralelismo que `node`. */
const peerNode = (id: string, title: string): TGraphNode => ({
  ...node,
  id,
  data: { ...node.data, sessionId: id, title, isRoot: false },
});

/**
 * `useDevice` arranca en móvil por defecto (el store no está sembrado), así que
 * el control de fullscreen solo se monta cuando el store global marca escritorio.
 * El store (`useGlobalStore`) lee el valor vía TanStack Query, así que se siembra
 * **antes** de renderizar: sembrarlo después no notifica al observador en el
 * mismo tick y el control no llegaría a montarse.
 */
const renderDesktop = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData([STORE_KEY.isMobile], false);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  service.getSessionMessages.mockResolvedValue([]);
  service.getMcpServers.mockResolvedValue([]);
  service.getSessionInstructions.mockResolvedValue([]);
  service.getSessionDiff.mockResolvedValue([]);
  service.listSessionForms.mockResolvedValue([]);
  service.getSessionPermissions.mockResolvedValue([]);
  service.listSessionInbox.mockResolvedValue([]);
  service.getSessionContext.mockResolvedValue([]);
});

describe('InspectorPanel', () => {
  it('prompts to select a node when none is provided', () => {
    renderWithProviders(<InspectorPanel node={null} />);
    expect(
      screen.getByText('Selecciona un nodo del grafo para ver su detalle.'),
    ).toBeInTheDocument();
  });

  it('renders the agent identity and the model data for a selected node', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
  });

  it('orders the data sections as Modelo → Métricas → Recursos → Duración mediana por herramienta → Subagentes → Archivos', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    const model = screen.getByText('Modelo');
    const metrics = screen.getByText('Métricas');
    const resources = screen.getByText('Recursos');
    const toolStats = screen.getByText('Duración mediana por herramienta');
    const subagents = screen.getByText('Subagentes');
    const files = screen.getByText('Archivos');

    expect(isBefore(model, metrics)).toBe(true);
    expect(isBefore(metrics, resources)).toBe(true);
    expect(isBefore(resources, toolStats)).toBe(true);
    expect(isBefore(toolStats, subagents)).toBe(true);
    expect(isBefore(subagents, files)).toBe(true);
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
  // US2 — "Avanzado" colapsado por defecto (FR-010..FR-015, SC-002, T015)
  // ---------------------------------------------------------------------------

  it('keeps the technical content collapsed under "Avanzado" by default (FR-010, SC-002)', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    const advanced = screen.getByRole('button', { name: 'Avanzado' });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');

    // El contenido técnico no se monta colapsado: no aparece en el DOM.
    expect(screen.queryByText('Herramientas')).not.toBeInTheDocument();
    expect(screen.queryByText('Respuestas')).not.toBeInTheDocument();
    expect(screen.queryByText('Preguntas y permisos')).not.toBeInTheDocument();
    expect(screen.queryByText('Errores')).not.toBeInTheDocument();
  });

  it('reveals Herramientas → Respuestas → Preguntas y permisos → Errores when expanded (FR-011)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InspectorPanel node={node} />);

    await user.click(screen.getByRole('button', { name: 'Avanzado' }));

    const tools = screen.getByText('Herramientas');
    const answers = screen.getByText('Respuestas');
    const questions = screen.getByText('Preguntas y permisos');
    const errors = screen.getByText('Errores');

    expect(isBefore(tools, answers)).toBe(true);
    expect(isBefore(answers, questions)).toBe(true);
    expect(isBefore(questions, errors)).toBe(true);
  });

  it('toggles the disclosure through aria-expanded (FR-012)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InspectorPanel node={node} />);

    expect(screen.getByRole('button', { name: 'Avanzado' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Avanzado' }));
    expect(screen.getByRole('button', { name: 'Avanzado' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Avanzado' }));
    expect(screen.getByRole('button', { name: 'Avanzado' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('hides the technical content again on collapse without reordering the rest (FR-012, SC-003)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InspectorPanel node={node} />);

    await user.click(screen.getByRole('button', { name: 'Avanzado' }));
    await user.click(screen.getByRole('button', { name: 'Avanzado' }));

    expect(screen.queryByText('Herramientas')).not.toBeInTheDocument();
    expect(screen.queryByText('Respuestas')).not.toBeInTheDocument();
    expect(screen.queryByText('Preguntas y permisos')).not.toBeInTheDocument();
    expect(screen.queryByText('Errores')).not.toBeInTheDocument();

    // El resto del panel conserva su orden tras colapsar.
    expect(
      isBefore(
        screen.getByText('Duración mediana por herramienta'),
        screen.getByText('Subagentes'),
      ),
    ).toBe(true);
    expect(
      isBefore(screen.getByText('Subagentes'), screen.getByText('Archivos')),
    ).toBe(true);
  });

  it('preserves the expansion state when the selected node changes (edge case)', async () => {
    const user = userEvent.setup();
    const other: TGraphNode = {
      ...node,
      id: 'child',
      data: {
        ...node.data,
        sessionId: 'child',
        title: 'Tarea hija',
        isRoot: false,
      },
    };

    const { rerender } = renderWithProviders(<InspectorPanel node={node} />);

    await user.click(screen.getByRole('button', { name: 'Avanzado' }));
    expect(screen.getByText('Herramientas')).toBeInTheDocument();

    // Cambiar de nodo sin desmontar el panel conserva el estado expandido.
    rerender(<InspectorPanel node={other} />);

    expect(screen.getByText('Tarea hija')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avanzado' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Herramientas')).toBeInTheDocument();
  });

  it('keeps the answers wiring (Respuestas, razonamiento, histórico) inside the expanded tree (FR-014)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InspectorPanel node={node} />);

    await user.click(screen.getByRole('button', { name: 'Avanzado' }));

    expect(screen.getByText('Respuestas')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /razonamiento/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver histórico completo' }),
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

    // Un único encabezado: ni "En paralelo (N)" ni "Tareas del subagente".
    expect(screen.getAllByText('Subagentes')).toHaveLength(1);
    expect(screen.queryByText(/^En paralelo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tareas del subagente')).not.toBeInTheDocument();

    const block = screen.getByText('Subagentes').parentElement as HTMLElement;
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

  it('shows the explicit empty state when there are no tasks nor peers (FR-008, T020)', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    expect(screen.getAllByText('Subagentes')).toHaveLength(1);
    expect(
      screen.getByText('Sin subagentes ni agentes en paralelo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^En paralelo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tareas del subagente')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// US6 — Pantalla completa del panel (FR-013..FR-015, T046, P7)
// ---------------------------------------------------------------------------

describe('InspectorPanel — control de pantalla completa (US6, T046, P7)', () => {
  it('escritorio: el encabezado incluye el control expandir/colapsar con aria-pressed/aria-label', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderDesktop(
      <InspectorPanel node={node} onToggleFullscreen={onToggle} />,
    );

    // El encabezado conserva el título/estado del nodo.
    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Pantalla completa' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('en fullscreen el mismo control refleja el estado y vuelve a colapsar', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderDesktop(
      <InspectorPanel
        node={node}
        isFullscreen
        onToggleFullscreen={onToggle}
      />,
    );

    const toggle = screen.getByRole('button', {
      name: 'Salir de pantalla completa',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('móvil: no monta el control de fullscreen, pero conserva el encabezado', () => {
    renderWithProviders(
      <InspectorPanel node={node} onToggleFullscreen={vi.fn()} />,
    );

    expect(
      screen.queryByRole('button', { name: /pantalla completa/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
  });
});

describe('InspectorPanel — fullscreen conserva encabezado y estados (US6, T046, P7)', () => {
  const fullscreen = () => (
    <InspectorPanel node={node} isFullscreen onToggleFullscreen={vi.fn()} />
  );

  it('datos: conserva el encabezado y el contenido del nodo', () => {
    renderDesktop(fullscreen());

    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Salir de pantalla completa' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Modelo')).toBeInTheDocument();
  });

  it('vacío: conserva el encabezado y el estado vacío de los archivos', async () => {
    service.getSessionDiff.mockResolvedValue([]);
    renderDesktop(fullscreen());

    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    await screen.findByText('Sin cambios de archivos');
  });

  it('carga: conserva el encabezado mientras el diff carga', () => {
    service.getSessionDiff.mockReturnValue(new Promise(() => {}));
    renderDesktop(fullscreen());

    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    expect(screen.getByText('Archivos')).toBeInTheDocument();
    expect(
      screen.queryByText('Sin cambios de archivos'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('error: conserva el encabezado y muestra el error del diff', async () => {
    service.getSessionDiff.mockRejectedValue(new Error('fallo de red'));
    renderDesktop(fullscreen());

    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    await screen.findByText('Error');
  });
});
