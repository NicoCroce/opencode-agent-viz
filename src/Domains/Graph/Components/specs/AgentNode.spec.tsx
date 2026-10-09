import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { NODE_STATUS_COLOR, NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { AgentNode } from '../AgentNode';
import {
  EMPTY_NODE_FOCUS,
  NodeFocusProvider,
  type TNodeFocus,
} from '../NodeFocusContext';
import type {
  TGraphNodeData,
  TNodeEffort,
  TNodeMetrics,
  TNodeStatus,
} from '../../Graph.entity';

const data: TGraphNodeData = {
  sessionId: 'root',
  title: 'Tarea de prueba',
  createdAt: null,
  updatedAt: null,
  agentName: 'develop',
  directory: '/repo/opencode-agent-viz',
  model: { providerID: 'opencode', id: 'deepseek' },
  status: 'running',
  retry: null,
  interruptReason: null,
  metrics: {
    durationMs: 83_000,
    startedAt: 0,
    endedAt: 83_000,
    cost: 0.02,
    tokens: { input: 1200, output: 300, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    invocations: 1,
    retryCount: 0,
    hasLoop: false,
    loopEvidence: [],
  },
  isRoot: true,
  currentTool: { name: 'bash', state: 'running' },
  parallel: null,
};

const props = {
  id: 'root',
  type: 'agent',
  data,
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
} as unknown as ComponentProps<typeof AgentNode>;

const renderAgentNode = (overrides: Partial<ComponentProps<typeof AgentNode>> = {}) =>
  render(
    <ReactFlowProvider>
      <AgentNode {...props} {...overrides} />
    </ReactFlowProvider>,
  );

/**
 * Monta el nodo dentro de un `NodeFocusProvider` con el foco indicado, para
 * verificar el resaltado por contexto (contrato de render §2).
 */
const renderAgentNodeWithFocus = (focus: TNodeFocus) =>
  render(
    <ReactFlowProvider>
      <NodeFocusProvider value={focus}>
        <AgentNode {...props} />
      </NodeFocusProvider>
    </ReactFlowProvider>,
  );

const nodeFocus = (overrides: Partial<TNodeFocus> = {}): TNodeFocus => ({
  selectedNodeId: null,
  lineageNodeIds: new Set<string>(),
  lineageEdgeIds: new Set<string>(),
  hoveredNodeId: null,
  ...overrides,
});

/** Elemento raíz del card (el único con `bg-surface-2`): recibe la opacidad de foco. */
const getCard = (container: HTMLElement): HTMLElement => {
  const card = container.querySelector('.bg-surface-2');
  if (!(card instanceof HTMLElement)) {
    throw new Error('No se encontró el card del AgentNode');
  }
  return card;
};

/**
 * Opacidad efectiva del nodo. El contrato de render §2 expresa el resaltado como
 * `opacity` numérica (`1` dentro del linaje, `0.15` fuera); `AgentNode` la
 * aplica como estilo en línea sobre el card. Sin foco no hay atenuación (`1`).
 */
const nodeOpacity = (container: HTMLElement): number => {
  const raw = getCard(container).style.opacity;
  return raw === '' ? 1 : Number(raw);
};

const pad = (value: number): string => String(value).padStart(2, '0');

const stamp = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const clock = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const START = new Date(2024, 0, 15, 9, 5).getTime();
const END = new Date(2024, 0, 15, 17, 42).getTime();
const NEXT_RETRY = new Date(2024, 0, 15, 12, 34).getTime();

const withData = (overrides: Partial<TGraphNodeData> = {}): TGraphNodeData => ({
  ...data,
  ...overrides,
});

const withMetrics = (overrides: Partial<TNodeMetrics> = {}): TNodeMetrics => ({
  ...data.metrics,
  ...overrides,
});

const renderWithNode = (
  status: TNodeStatus,
  metrics: Partial<TNodeMetrics>,
) => renderAgentNode({ data: withData({ status, metrics: withMetrics(metrics) }) });

const ACTIVE_STATUSES: TNodeStatus[] = [
  'running',
  'retrying',
  'compacting',
  'waiting-permission',
  'waiting-input',
];

const INACTIVE_STATUSES: TNodeStatus[] = [
  'created',
  'succeeded',
  'failed',
  'interrupted',
];

describe('AgentNode', () => {
  it('renders the session title, metrics and current tool', () => {
    renderAgentNode();
    expect(screen.getByText('Tarea de prueba')).toBeInTheDocument();
    expect(screen.queryByText('develop')).not.toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('renders the NodeResizer resize controls', () => {
    const { container } = renderAgentNode();
    const controls = container.querySelectorAll('.react-flow__resize-control');
    expect(controls.length).toBeGreaterThan(0);
    expect(container.querySelector('.react-flow__resize-control.line')).toBeInTheDocument();
    expect(container.querySelector('.react-flow__resize-control.handle')).toBeInTheDocument();
  });

  it('uses border-accent on the selected node while a non-selected ancestor does not', () => {
    const selected = renderAgentNode({ selected: true });
    const selectedNode = selected.container.querySelector('.border-accent');
    expect(selectedNode).toBeInTheDocument();
    expect(selectedNode).toHaveClass('border-accent');

    const ancestor = renderAgentNode({ selected: false });
    expect(ancestor.container.querySelector('.border-accent')).toBeNull();
    expect(ancestor.container.querySelector('.border-border')).toBeInTheDocument();
  });
});

describe('AgentNode — título', () => {
  it('shows the session title instead of the agent name', () => {
    renderAgentNode();
    expect(screen.getByText('Tarea de prueba')).toBeInTheDocument();
    expect(screen.queryByText('develop')).not.toBeInTheDocument();
  });

  it('falls back to the agent name when the session has no title', () => {
    renderAgentNode({ data: withData({ title: null }) });
    expect(screen.getByText('develop')).toBeInTheDocument();
  });
});

describe('AgentNode — modelo', () => {
  it('renders provider/model and the variant tag', () => {
    renderAgentNode({
      data: withData({
        model: {
          providerID: 'opencode-go',
          id: 'deepseek-v4.1-flash',
          variant: 'high',
        },
      }),
    });

    expect(
      screen.getByText('opencode-go/deepseek-v4.1-flash'),
    ).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('hides the model line when the node has no model', () => {
    renderAgentNode({ data: withData({ model: null }) });
    expect(screen.queryByText('opencode/deepseek')).not.toBeInTheDocument();
  });
});

describe('AgentNode — consumo resumido', () => {
  it('renders tokens, cost and duration on one line', () => {
    renderAgentNode();
    expect(screen.getByText('1.5k tok')).toBeInTheDocument();
    expect(screen.getByText('$0.0200')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it('shows the model line but not the labeled sections', () => {
    renderAgentNode();
    expect(screen.queryByText('Modelo')).not.toBeInTheDocument();
    expect(screen.queryByText('Consumo')).not.toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
  });
});

describe('AgentNode — rango horario (US5)', () => {
  it('renders the start – end range from metrics.startedAt/endedAt alongside the duration', () => {
    renderWithNode('succeeded', { startedAt: START, endedAt: END });

    expect(
      screen.getByText(`${stamp(START)} – ${stamp(END)}`),
    ).toBeInTheDocument();
    // El rango convive con la duración existente; no la reemplaza.
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it.each<TNodeStatus>(ACTIVE_STATUSES)(
    'shows "inicio – en curso" while the node status is %s',
    (status) => {
      renderWithNode(status, { startedAt: START, endedAt: null });

      expect(
        screen.getByText(`${stamp(START)} – en curso`),
      ).toBeInTheDocument();
    },
  );

  it('prefers "en curso" over a present endedAt while running', () => {
    renderWithNode('running', { startedAt: START, endedAt: END });

    expect(
      screen.getByText(`${stamp(START)} – en curso`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`${stamp(START)} – ${stamp(END)}`),
    ).not.toBeInTheDocument();
  });

  it('shows "no disponible" for a missing endedAt when not running', () => {
    renderWithNode('succeeded', { startedAt: START, endedAt: null });

    expect(
      screen.getByText(`${stamp(START)} – no disponible`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" for a missing startedAt when not running', () => {
    renderWithNode('succeeded', { startedAt: null, endedAt: END });

    expect(
      screen.getByText(`no disponible – ${stamp(END)}`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" on both ends when both timestamps are missing', () => {
    renderWithNode('succeeded', { startedAt: null, endedAt: null });

    expect(
      screen.getByText('no disponible – no disponible'),
    ).toBeInTheDocument();
  });
});

describe('AgentNode — paralelismo', () => {
  it('renders the parallel badge with the group size', () => {
    renderAgentNode({
      data: withData({ parallel: { groupId: 'g', size: 4 } }),
    });

    const badge = screen.getByText('∥4');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute(
      'title',
      '4 agentes ejecutados en paralelo',
    );
    expect(badge).toHaveClass('text-foreground');
  });

  it('does not render a badge when the node ran alone', () => {
    renderAgentNode({ data: withData({ parallel: null }) });
    expect(screen.queryByText(/∥/)).not.toBeInTheDocument();
  });

  it('does not render a badge for a group of one', () => {
    renderAgentNode({
      data: withData({ parallel: { groupId: 'g', size: 1 } }),
    });
    expect(screen.queryByText(/∥/)).not.toBeInTheDocument();
  });
});

describe('AgentNode — medidor de esfuerzo (T017, S9)', () => {
  const effort = (overrides: Partial<TNodeEffort> = {}): TNodeEffort => ({
    level: 3,
    provisional: false,
    reasons: ['lanzó paralelos', 'supera 2× la línea'],
    ...overrides,
  });

  it('renders the effort meter with the accessible label when the node has effort', () => {
    renderAgentNode({ data: withData({ effort: effort() }) });

    expect(
      screen.getByRole('img', {
        name: 'Esfuerzo 3 de 5: lanzó paralelos, supera 2× la línea',
      }),
    ).toBeInTheDocument();
  });

  it('places the meter in the header row, alongside the parallel badge', () => {
    renderAgentNode({
      data: withData({
        effort: effort({ level: 4 }),
        parallel: { groupId: 'g', size: 3 },
      }),
    });

    const meter = screen.getByRole('img', { name: /^Esfuerzo 4 de 5/ });
    const badge = screen.getByText('∥3');

    // Misma fila: ambos comparten el contenedor del grupo derecho del encabezado
    // (no se añade una fila nueva, effort-contract §5).
    expect(meter.parentElement).toBe(badge.parentElement);
  });

  it('does not render the meter when the node has no effort', () => {
    renderAgentNode({ data: withData({ effort: null }) });

    expect(
      screen.queryByRole('img', { name: /^Esfuerzo/ }),
    ).not.toBeInTheDocument();
  });
});

describe('AgentNode — estado enriquecido (US3, FR-017/FR-023)', () => {
  it.each<TNodeStatus>(Object.keys(NODE_STATUS_LABEL) as TNodeStatus[])(
    'renders the %s label',
    (status) => {
      renderAgentNode({ data: withData({ status }) });
      expect(screen.getByText(NODE_STATUS_LABEL[status])).toBeInTheDocument();
    },
  );
});

describe('AgentNode — reintento (US3, FR-018)', () => {
  it('shows the attempt number and the next attempt moment', () => {
    renderAgentNode({
      data: withData({
        status: 'retrying',
        retry: { attempt: 2, next: NEXT_RETRY },
      }),
    });

    expect(
      screen.getByText(`Intento 2 · próximo ${clock(NEXT_RETRY)}`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" for the next attempt when the server omits it', () => {
    renderAgentNode({
      data: withData({
        status: 'retrying',
        retry: { attempt: 3, next: null },
      }),
    });

    expect(
      screen.getByText('Intento 3 · próximo no disponible'),
    ).toBeInTheDocument();
  });

  it('does not show retry details when there is no retry', () => {
    renderAgentNode({ data: withData({ status: 'running', retry: null }) });
    expect(screen.queryByText(/Intento/)).not.toBeInTheDocument();
  });
});

describe('AgentNode — interrupción (US3, FR-019)', () => {
  it('shows the interruption reason', () => {
    renderAgentNode({
      data: withData({
        status: 'interrupted',
        interruptReason: 'Cancelada por el usuario',
      }),
    });

    expect(
      screen.getByText('Motivo: Cancelada por el usuario'),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" when the interruption reason is missing', () => {
    renderAgentNode({
      data: withData({ status: 'interrupted', interruptReason: null }),
    });

    expect(screen.getByText('Motivo: no disponible')).toBeInTheDocument();
  });

  it('does not show an interruption reason while the execution is not interrupted', () => {
    renderAgentNode({
      data: withData({ status: 'failed', interruptReason: 'Cancelada' }),
    });

    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument();
  });
});

describe('AgentNode — foco por contexto (T025, C4)', () => {
  it('keeps the node fully opaque outside a NodeFocusProvider (EMPTY_NODE_FOCUS)', () => {
    const { container } = renderAgentNode();

    expect(nodeOpacity(container)).toBe(1);
  });

  it('defines EMPTY_NODE_FOCUS without selection, lineage or hover', () => {
    expect(EMPTY_NODE_FOCUS.selectedNodeId).toBeNull();
    expect(EMPTY_NODE_FOCUS.lineageNodeIds.size).toBe(0);
    expect(EMPTY_NODE_FOCUS.lineageEdgeIds.size).toBe(0);
    expect(EMPTY_NODE_FOCUS.hoveredNodeId).toBeNull();
  });

  it('keeps the node fully opaque when there is no selection', () => {
    const { container } = renderAgentNodeWithFocus(nodeFocus());

    expect(nodeOpacity(container)).toBe(1);
  });

  it('keeps the node fully opaque when it belongs to the selected lineage', () => {
    const { container } = renderAgentNodeWithFocus(
      nodeFocus({ selectedNodeId: 'root', lineageNodeIds: new Set(['root']) }),
    );

    expect(nodeOpacity(container)).toBe(1);
  });

  it('dims the node to 0.15 when it is outside the selected lineage', () => {
    const { container } = renderAgentNodeWithFocus(
      nodeFocus({
        selectedNodeId: 'other',
        lineageNodeIds: new Set(['other']),
      }),
    );

    expect(nodeOpacity(container)).toBe(0.15);
  });

  it('ignores hover on the node when there is no selection (hover only affects edges)', () => {
    const { container } = renderAgentNodeWithFocus(
      nodeFocus({ hoveredNodeId: 'root' }),
    );

    expect(nodeOpacity(container)).toBe(1);
  });

  it('lets lineage take precedence over hover on the same node', () => {
    const { container } = renderAgentNodeWithFocus(
      nodeFocus({
        selectedNodeId: 'other',
        lineageNodeIds: new Set(['other']),
        hoveredNodeId: 'root',
      }),
    );

    expect(nodeOpacity(container)).toBe(0.15);
  });

  it('keeps a lineage node fully opaque even while hovered', () => {
    const { container } = renderAgentNodeWithFocus(
      nodeFocus({
        selectedNodeId: 'root',
        lineageNodeIds: new Set(['root']),
        hoveredNodeId: 'root',
      }),
    );

    expect(nodeOpacity(container)).toBe(1);
  });
});

describe('AgentNode — animación "pensando" del rail (T023, A1/A2/A3)', () => {
  const getRail = (container: HTMLElement): HTMLElement => {
    const rail = container.querySelector('[data-testid="node-status-rail"]');
    if (!(rail instanceof HTMLElement)) {
      throw new Error('No se encontró el rail de estado del AgentNode');
    }
    return rail;
  };

  /**
   * Estados activos sin rayado: son los únicos que muestran el barrido
   * (`.rail-scan`). `retrying` queda fuera porque siempre va rayado.
   */
  const SCANNING_STATUSES: TNodeStatus[] = [
    'running',
    'compacting',
    'waiting-permission',
    'waiting-input',
  ];

  it.each<TNodeStatus>(SCANNING_STATUSES)(
    'renders the rail with .rail-scan while the node is active (%s)',
    (status) => {
      const { container } = renderWithNode(status, { hasLoop: false });
      const rail = getRail(container);

      expect(rail).toHaveClass('rail-scan');
      // La clase base de color de estado se conserva junto al barrido.
      expect(rail).toHaveClass(NODE_STATUS_COLOR[status]);
    },
  );

  it.each<TNodeStatus>(INACTIVE_STATUSES)(
    'does not render .rail-scan once the node is terminal (%s)',
    (status) => {
      const { container } = renderWithNode(status, { hasLoop: false });

      expect(getRail(container)).not.toHaveClass('rail-scan');
    },
  );

  it('keeps the loop stripe instead of the scan for a retrying node', () => {
    // `retrying` es activo pero rayado: el rayado (LOOP_STRIPE) gana.
    const { container } = renderWithNode('retrying', { hasLoop: false });
    const rail = getRail(container);

    expect(rail).not.toHaveClass('rail-scan');
    expect(rail.style.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('does not scan a running node that is striped by a detected loop', () => {
    const { container } = renderWithNode('running', { hasLoop: true });
    const rail = getRail(container);

    expect(rail).not.toHaveClass('rail-scan');
    expect(rail.style.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('keeps the base static class as the reduced-motion fallback (FR-003)', () => {
    // Con `prefers-reduced-motion` el bloque global anula la animación y el
    // rail queda en color de actividad sólido y estático: la clase base de
    // color permanece junto a `.rail-scan`.
    const { container } = renderWithNode('running', { hasLoop: false });
    const rail = getRail(container);

    expect(rail).toHaveClass('rail-scan');
    expect(rail).toHaveClass('bg-status-running');
  });
});

describe('index.css — barrido del rail (T024, A3)', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

  it('defines the rail-scan keyframes and the .rail-scan class', () => {
    expect(css).toMatch(/@keyframes\s+rail-scan/);
    expect(css).toMatch(/\.rail-scan\b/);
  });

  it('declares the static state inside the global reduced-motion block (FR-003)', () => {
    const reducedMotion = css.slice(
      css.indexOf('prefers-reduced-motion: reduce'),
    );

    expect(reducedMotion).toMatch(/\.rail-scan/);
  });
});
