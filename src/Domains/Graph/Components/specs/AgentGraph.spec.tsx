import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERF_METRIC, perfMeasure } from '@app/Application/Helpers/perf';
import type { TGraphModel, TGraphNodeData } from '../../Graph.entity';
import type { TExecutionPlan } from '../../lib/executionLevels';

/**
 * Captura de las props que `AgentGraph` entrega a `<ReactFlow>` en cada render.
 * Permite verificar la **estabilidad de referencia** de `nodes`/`edges` ante
 * hover/selección (contrato de render §1.2, criterio C3) sin depender de la
 * medición interna del viewport.
 */
const reactFlowSpy = vi.hoisted(() => ({
  nodes: [] as Array<{
    id: string;
    width?: number;
    height?: number;
    position?: { x: number; y: number };
  }>,
  edges: [] as Array<{ id: string; source: string; target: string }>,
}));

/**
 * La instrumentación `perf` se sustituye por espías para observar el número de
 * medidas `graph.interaction` por transición (criterio P5) sin depender de la
 * Performance API de jsdom (el helper real se cubre en `perf.spec.ts`).
 */
vi.mock('@app/Application/Helpers/perf', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@app/Application/Helpers/perf')>();
  return {
    ...actual,
    perfMark: vi.fn(),
    perfMeasure: vi.fn(() => 0),
  };
});

/**
 * `AgentGraph` orquesta React Flow; el comportamiento de T039 (doble clic →
 * histórico, clic simple → selección) se verifica sustituyendo `ReactFlow` por
 * un stub que expone los mismos handlers con nodos en el DOM. Así el test es
 * estable en jsdom y no depende de la medición interna del viewport.
 */
vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  // El foco vive en un contexto propio (no en `@xyflow/react`); se importa el
  // módulo real para publicarlo como sonda dentro del stub (contrato §1.2/§2).
  const { useNodeFocus } = await import('../NodeFocusContext');

  interface MockNode {
    id: string;
    type?: string;
  }

  interface MockEdge {
    id: string;
    source: string;
    target: string;
  }

  interface MockReactFlowProps {
    nodes: MockNode[];
    edges: MockEdge[];
    onNodeClick?: (event: unknown, node: MockNode) => void;
    onNodeDoubleClick?: (event: unknown, node: MockNode) => void;
    onNodeMouseEnter?: (event: unknown, node: MockNode) => void;
    onPaneClick?: () => void;
    onNodesChange?: (changes: Array<Record<string, unknown>>) => void;
  }

  /**
   * Sonda del foco publicado por `AgentGraph` por contexto. Expone el linaje
   * (`nodeIds`/`edgeIds`), la selección y el hover como atributos `data-*` para
   * verificar la paridad del linaje (FR-007, SC-006) sin renderizar los nodos.
   */
  const FocusProbe = () => {
    const focus = useNodeFocus();
    return React.createElement('div', {
      'data-testid': 'focus-probe',
      'data-selected': focus.selectedNodeId ?? '',
      'data-hovered': focus.hoveredNodeId ?? '',
      'data-lineage-nodes': [...focus.lineageNodeIds].sort().join(','),
      'data-lineage-edges': [...focus.lineageEdgeIds].sort().join(','),
    });
  };

  return {
    ReactFlow: ({
      nodes,
      edges,
      onNodeClick,
      onNodeDoubleClick,
      onNodeMouseEnter,
      onPaneClick,
      onNodesChange,
    }: MockReactFlowProps) => {
      // Última referencia entregada a React Flow, para aseverar estabilidad.
      reactFlowSpy.nodes = nodes;
      reactFlowSpy.edges = edges;

      return React.createElement(
        'div',
        { 'data-testid': 'react-flow' },
        nodes.map((node) =>
          React.createElement(
            'button',
            {
              key: node.id,
              type: 'button',
              'data-testid': `node-${node.id}`,
              'data-node-type': String(node.type),
              onClick: () => onNodeClick?.({}, node),
              onDoubleClick: () => onNodeDoubleClick?.({}, node),
              onMouseEnter: () => onNodeMouseEnter?.({}, node),
            },
            node.id,
          ),
        ),
        // Disparador del resize del usuario para verificar el reseteo por sesión.
        nodes.map((node) =>
          React.createElement(
            'button',
            {
              key: `resize-${node.id}`,
              type: 'button',
              'data-testid': `resize-${node.id}`,
              onClick: () =>
                onNodesChange?.([
                  {
                    id: node.id,
                    type: 'dimensions',
                    dimensions: { width: 640, height: 320 },
                    resizing: false,
                  },
                ]),
            },
            `resize-${node.id}`,
          ),
        ),
        React.createElement('button', {
          key: 'pane',
          type: 'button',
          'data-testid': 'pane',
          onClick: () => onPaneClick?.(),
        }),
        React.createElement(FocusProbe, { key: 'focus-probe' }),
      );
    },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Background: () => null,
    Controls: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    useReactFlow: () => ({
      getNode: () => null,
      setCenter: () => undefined,
      fitView: () => undefined,
    }),
  };
});

import { AgentGraph } from '../AgentGraph';

const data: TGraphNodeData = {
  sessionId: 'root',
  title: 'Tarea de prueba',
  createdAt: 0,
  updatedAt: 1,
  agentName: 'develop',
  directory: '/repo/opencode-agent-viz',
  model: null,
  status: 'succeeded',
  retry: null,
  interruptReason: null,
  metrics: {
    durationMs: null,
    startedAt: null,
    endedAt: null,
    cost: null,
    tokens: null,
    invocations: 1,
    retryCount: 0,
    hasLoop: false,
    loopEvidence: [],
  },
  isRoot: true,
  currentTool: null,
  parallel: null,
};

const graph: TGraphModel = {
  nodes: [{ id: 'root', type: 'agent', position: { x: 0, y: 0 }, data }],
  edges: [],
};

const plan: TExecutionPlan = {
  levels: [
    { level: 0, nodeIds: ['root'], startedAt: 0, endedAt: 1, parallel: false },
  ],
  levelByNode: { root: 0 },
  columnByNode: { root: 0 },
  width: 300,
};

interface RenderGraphOptions {
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onClearSelection?: () => void;
  onOpenHistory?: (nodeId: string) => void;
  followNodeId?: string | null;
  resetKey?: string | null;
}

const renderGraph = ({
  selectedNodeId = null,
  onSelectNode = vi.fn(),
  onClearSelection = vi.fn(),
  onOpenHistory = vi.fn(),
  followNodeId = null,
  resetKey = null,
}: RenderGraphOptions = {}) =>
  render(
    <AgentGraph
      graph={graph}
      plan={plan}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      onClearSelection={onClearSelection}
      onOpenHistory={onOpenHistory}
      followNodeId={followNodeId}
      resetKey={resetKey}
    />,
  );

describe('AgentGraph — apertura del histórico (T039)', () => {
  it('opens the history of the double-clicked agent node', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    renderGraph({ onOpenHistory });

    await user.dblClick(screen.getByTestId('node-root'));

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
    expect(onOpenHistory).toHaveBeenCalledWith('root');
  });

  it('keeps the simple click selecting the node and does not open the history', async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    const onOpenHistory = vi.fn();
    renderGraph({ onSelectNode, onOpenHistory });

    await user.click(screen.getByTestId('node-root'));

    expect(onSelectNode).toHaveBeenCalledTimes(1);
    expect(onSelectNode).toHaveBeenCalledWith('root');
    expect(onOpenHistory).not.toHaveBeenCalled();
  });

  it('ignores the double click on a gutter node', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    renderGraph({ onOpenHistory });

    const gutter = screen.getByTestId('node-gutter-0');
    expect(gutter).toHaveAttribute('data-node-type', 'gutter');
    await user.dblClick(gutter);

    expect(onOpenHistory).not.toHaveBeenCalled();
  });

  it('still clears the selection on a pane click', async () => {
    const user = userEvent.setup();
    const onClearSelection = vi.fn();
    renderGraph({ onClearSelection });

    await user.click(screen.getByTestId('pane'));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('renders with follow and reset keys without breaking selection', () => {
    renderGraph({
      selectedNodeId: 'root',
      followNodeId: 'root',
      resetKey: 'root',
    });

    expect(screen.getByTestId('node-root')).toBeInTheDocument();
  });
});

/**
 * Fixture con linaje real (raíz → hija → nieta) para ejercitar hover/selección
 * sin tocar los casos existentes, que usan un grafo de un solo nodo.
 */
const focusData = (sessionId: string, isRoot: boolean): TGraphNodeData => ({
  ...data,
  sessionId,
  isRoot,
  title: `Sesión ${sessionId}`,
});

const focusGraph: TGraphModel = {
  nodes: [
    {
      id: 'root',
      type: 'agent',
      position: { x: 0, y: 0 },
      data: focusData('root', true),
    },
    {
      id: 'child',
      type: 'agent',
      position: { x: 0, y: 120 },
      data: focusData('child', false),
    },
    {
      id: 'grandchild',
      type: 'agent',
      position: { x: 0, y: 240 },
      data: focusData('grandchild', false),
    },
  ],
  edges: [
    { id: 'e-root-child', source: 'root', target: 'child', type: 'agent' },
    {
      id: 'e-child-grandchild',
      source: 'child',
      target: 'grandchild',
      type: 'agent',
    },
  ],
};

const focusPlan: TExecutionPlan = {
  levels: [
    { level: 0, nodeIds: ['root'], startedAt: 0, endedAt: 1, parallel: false },
    { level: 1, nodeIds: ['child'], startedAt: 0, endedAt: 1, parallel: false },
    {
      level: 2,
      nodeIds: ['grandchild'],
      startedAt: 0,
      endedAt: 1,
      parallel: false,
    },
  ],
  levelByNode: { root: 0, child: 1, grandchild: 2 },
  columnByNode: { root: 0, child: 0, grandchild: 0 },
  width: 300,
};

interface FocusGraphOptions {
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onClearSelection?: () => void;
}

const focusGraphElement = ({
  selectedNodeId = null,
  onSelectNode = vi.fn(),
  onClearSelection = vi.fn(),
}: FocusGraphOptions = {}) => (
  <AgentGraph
    graph={focusGraph}
    plan={focusPlan}
    selectedNodeId={selectedNodeId}
    onSelectNode={onSelectNode}
    onClearSelection={onClearSelection}
  />
);

/** Medidas `graph.interaction` registradas por la instrumentación. */
const interactionMeasures = () =>
  vi
    .mocked(perfMeasure)
    .mock.calls.filter(([name]) => name === PERF_METRIC.interaction);

/**
 * Criterio C3 del contrato de render (`specs/006-graph-render-performance/contracts/graph-render-contract.md`):
 * el array `nodes`/`edges` que recibe `<ReactFlow>` **no cambia de referencia**
 * cuando cambia el hover o la selección; el foco se publica por contexto.
 */
describe('AgentGraph — identidad estable ante hover/selección (C3)', () => {
  it('no recrea los arrays de nodos/aristas al hacer hover', async () => {
    const user = userEvent.setup();
    render(focusGraphElement());

    const nodesBefore = reactFlowSpy.nodes;
    const edgesBefore = reactFlowSpy.edges;

    await user.hover(screen.getByTestId('node-child'));

    expect(reactFlowSpy.nodes).toBe(nodesBefore);
    expect(reactFlowSpy.edges).toBe(edgesBefore);
  });

  it('no recrea los arrays de nodos/aristas al cambiar la selección', () => {
    const { rerender } = render(focusGraphElement({ selectedNodeId: null }));

    const nodesBefore = reactFlowSpy.nodes;
    const edgesBefore = reactFlowSpy.edges;

    rerender(focusGraphElement({ selectedNodeId: 'child' }));

    expect(reactFlowSpy.nodes).toBe(nodesBefore);
    expect(reactFlowSpy.edges).toBe(edgesBefore);
  });
});

/**
 * Criterio P5 del contrato de instrumentación
 * (`specs/006-graph-render-performance/contracts/performance-instrumentation-contract.md`):
 * la marca `graph.interaction` se toma **por transición**, no por
 * `mousemove`/frame. Una transición de hover o selección registra una única
 * medida; un render sin transición no registra ninguna.
 */
describe('AgentGraph — medición de interacción acotada a la transición (P5)', () => {
  it('registra una sola medida por transición de hover', async () => {
    const user = userEvent.setup();
    render(focusGraphElement());
    vi.mocked(perfMeasure).mockClear();

    await user.hover(screen.getByTestId('node-child'));

    expect(interactionMeasures()).toHaveLength(1);
  });

  it('registra una sola medida por transición de selección', () => {
    const { rerender } = render(focusGraphElement({ selectedNodeId: null }));
    vi.mocked(perfMeasure).mockClear();

    rerender(focusGraphElement({ selectedNodeId: 'child' }));

    expect(interactionMeasures()).toHaveLength(1);
  });

  it('no registra medidas sin transición (no marca por frame)', () => {
    const { rerender } = render(focusGraphElement({ selectedNodeId: 'child' }));
    vi.mocked(perfMeasure).mockClear();

    rerender(focusGraphElement({ selectedNodeId: 'child' }));

    expect(interactionMeasures()).toHaveLength(0);
  });
});

/**
 * Fixture con bifurcación (raíz → alpha/beta; alpha → alpha-child) para
 * verificar que el linaje publicado por contexto es idéntico al de la línea
 * base (`deriveLineage`): al seleccionar `alpha` se resaltan sus ancestros y
 * descendientes, excluyendo la rama hermana `beta` (FR-007, SC-006).
 */
const lineageGraph: TGraphModel = {
  nodes: [
    {
      id: 'root',
      type: 'agent',
      position: { x: 0, y: 0 },
      data: focusData('root', true),
    },
    {
      id: 'alpha',
      type: 'agent',
      position: { x: 0, y: 120 },
      data: focusData('alpha', false),
    },
    {
      id: 'beta',
      type: 'agent',
      position: { x: 240, y: 120 },
      data: focusData('beta', false),
    },
    {
      id: 'alpha-child',
      type: 'agent',
      position: { x: 0, y: 240 },
      data: focusData('alpha-child', false),
    },
  ],
  edges: [
    { id: 'root->alpha', source: 'root', target: 'alpha', type: 'agent' },
    { id: 'root->beta', source: 'root', target: 'beta', type: 'agent' },
    {
      id: 'alpha->alpha-child',
      source: 'alpha',
      target: 'alpha-child',
      type: 'agent',
    },
  ],
};

const lineagePlan: TExecutionPlan = {
  levels: [
    { level: 0, nodeIds: ['root'], startedAt: 0, endedAt: 1, parallel: false },
    {
      level: 1,
      nodeIds: ['alpha', 'beta'],
      startedAt: 0,
      endedAt: 1,
      parallel: true,
    },
    {
      level: 2,
      nodeIds: ['alpha-child'],
      startedAt: 0,
      endedAt: 1,
      parallel: false,
    },
  ],
  levelByNode: { root: 0, alpha: 1, beta: 1, 'alpha-child': 2 },
  columnByNode: { root: 0, alpha: 0, beta: 1, 'alpha-child': 0 },
  width: 300,
};

const lineageElement = (
  selectedNodeId: string | null,
  graph: TGraphModel = lineageGraph,
  resetKey: string | null = null,
) => (
  <AgentGraph
    graph={graph}
    plan={lineagePlan}
    selectedNodeId={selectedNodeId}
    onSelectNode={vi.fn()}
    onClearSelection={vi.fn()}
    resetKey={resetKey}
  />
);

const focusProbe = (): HTMLElement => screen.getByTestId('focus-probe');
const probeLineageNodes = (): string | null =>
  focusProbe().getAttribute('data-lineage-nodes');
const probeLineageEdges = (): string | null =>
  focusProbe().getAttribute('data-lineage-edges');

/**
 * Paridad de linaje (FR-007, SC-006): el foco que `AgentGraph` publica por
 * contexto es idéntico al de la línea base (`deriveLineage`), incluso tras
 * reconciliar un modelo equivalente.
 */
describe('AgentGraph — paridad de linaje (FR-007, SC-006)', () => {
  it('publica ancestros y descendientes del seleccionado sin la rama hermana', () => {
    render(lineageElement('alpha'));

    expect(probeLineageNodes()).toBe('alpha,alpha-child,root');
    expect(probeLineageEdges()).toBe('alpha->alpha-child,root->alpha');
    expect(probeLineageNodes()).not.toContain('beta');
  });

  it('resalta el árbol completo al seleccionar la raíz', () => {
    render(lineageElement('root'));

    expect(probeLineageNodes()).toBe('alpha,alpha-child,beta,root');
    expect(probeLineageEdges()).toBe(
      'alpha->alpha-child,root->alpha,root->beta',
    );
  });

  it('cambia el linaje al cambiar la selección', () => {
    const { rerender } = render(lineageElement('alpha'));

    rerender(lineageElement('beta'));

    expect(probeLineageNodes()).toBe('beta,root');
    expect(probeLineageEdges()).toBe('root->beta');
  });

  it('el hover publica el nodo bajo el cursor sin alterar el linaje', async () => {
    const user = userEvent.setup();
    render(lineageElement(null));

    await user.hover(screen.getByTestId('node-beta'));

    expect(focusProbe()).toHaveAttribute('data-hovered', 'beta');
    expect(probeLineageNodes()).toBe('');
    expect(probeLineageEdges()).toBe('');
  });

  it('mantiene el linaje idéntico tras reconciliar un modelo equivalente', () => {
    const { rerender } = render(lineageElement('alpha'));
    const nodesBefore = probeLineageNodes();
    const edgesBefore = probeLineageEdges();

    // Nuevo modelo por referencia pero con el mismo contenido: la reconciliación
    // (T028) no debe alterar el linaje derivado.
    rerender(lineageElement('alpha', structuredClone(lineageGraph)));

    expect(probeLineageNodes()).toBe(nodesBefore);
    expect(probeLineageEdges()).toBe(edgesBefore);
  });
});

/**
 * Paridad de resize e histórico al cambiar de sesión (FR-007, SC-006;
 * escenario 3 de la Historia 4): el tamaño elegido por el usuario se resetea al
 * cambiar de sesión y el doble clic sigue abriendo el histórico del nodo.
 */
describe('AgentGraph — paridad de resize e histórico (FR-007, SC-006)', () => {
  it('resetea el tamaño elegido por el usuario al cambiar de sesión', () => {
    const { rerender } = render(
      lineageElement(null, lineageGraph, 'session-a'),
    );
    const defaultWidth = reactFlowSpy.nodes.find(
      (node) => node.id === 'root',
    )?.width;

    fireEvent.click(screen.getByTestId('resize-root'));
    const resized = reactFlowSpy.nodes.find((node) => node.id === 'root');
    expect(resized?.width).toBe(640);
    expect(resized?.height).toBe(320);

    rerender(lineageElement(null, lineageGraph, 'session-b'));

    const afterReset = reactFlowSpy.nodes.find((node) => node.id === 'root');
    expect(afterReset?.width).toBe(defaultWidth);
    expect(afterReset?.width).not.toBe(640);
  });

  it('mantiene el tamaño dentro de la misma sesión', () => {
    const { rerender } = render(
      lineageElement(null, lineageGraph, 'session-a'),
    );

    fireEvent.click(screen.getByTestId('resize-root'));
    rerender(lineageElement(null, lineageGraph, 'session-a'));

    expect(
      reactFlowSpy.nodes.find((node) => node.id === 'root')?.width,
    ).toBe(640);
  });

  it('sigue abriendo el histórico del nodo correcto tras cambiar de sesión', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    const { rerender } = render(
      <AgentGraph
        graph={lineageGraph}
        plan={lineagePlan}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        onClearSelection={vi.fn()}
        onOpenHistory={onOpenHistory}
        resetKey="session-a"
      />,
    );

    rerender(
      <AgentGraph
        graph={lineageGraph}
        plan={lineagePlan}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        onClearSelection={vi.fn()}
        onOpenHistory={onOpenHistory}
        resetKey="session-b"
      />,
    );

    await user.dblClick(screen.getByTestId('node-alpha-child'));

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
    expect(onOpenHistory).toHaveBeenCalledWith('alpha-child');
  });
});
