import { describe, expect, it, vi } from 'vitest';
import type {
  TGraphEdge,
  TGraphModel,
  TGraphNode,
  TGraphNodeData,
} from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { mergeEnrichedNodes } from '../mergeEnrichedNodes';

/**
 * Spec de `mergeEnrichedNodes` (T026, FR-013; data-model §2.2 y
 * `contracts/enrichment-pure-api.md` §3):
 *
 * - Solo `readyIds.has(id)` cambia `data`; el resto conserva la referencia.
 * - La entrada no se muta y `edges` sale por referencia.
 */

const node = (id: string): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: `tarea ${id}`,
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo',
    model: null,
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: { ...EMPTY_METRICS },
    isRoot: false,
    currentTool: null,
    parallel: null,
    enrichment: 'pending',
  },
});

const structure = (): TGraphModel => ({
  nodes: [node('A'), node('B')],
  edges: [
    { id: 'e1', source: 'A', target: 'B', type: 'agent' },
  ] satisfies TGraphEdge[],
});

/** Datos fusionados distinguibles del original (marca `enrichment: 'ready'`). */
const readyData = (target: TGraphNode): TGraphNodeData => ({
  ...target.data,
  enrichment: 'ready',
});

describe('mergeEnrichedNodes — nodos listos vs. pendientes (FR-013)', () => {
  it('un nodo no listo conserva la referencia (nodo y data)', () => {
    const input = structure();
    const pending = input.nodes[1];

    const output = mergeEnrichedNodes(
      input,
      new Set(['A']),
      readyData,
    );

    expect(output.nodes[1]).toBe(pending);
    expect(output.nodes[1].data).toBe(pending.data);
  });

  it('un nodo listo cambia solo su `data` (nodo nuevo, data nueva)', () => {
    const input = structure();
    const ready = input.nodes[0];

    const output = mergeEnrichedNodes(input, new Set(['A']), readyData);

    expect(output.nodes[0]).not.toBe(ready);
    expect(output.nodes[0].data).not.toBe(ready.data);
    expect(output.nodes[0].data.enrichment).toBe('ready');
    expect(output.nodes[0]).toMatchObject({
      id: ready.id,
      type: ready.type,
      position: ready.position,
    });
  });

  it('solo invoca `buildNodeData` con los nodos listos', () => {
    const input = structure();
    const build = vi.fn(readyData);

    mergeEnrichedNodes(input, new Set(['B']), build);

    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(input.nodes[1]);
  });

  it('no muta la entrada y devuelve `edges` por referencia', () => {
    const input = structure();

    const output = mergeEnrichedNodes(input, new Set(['A']), readyData);

    expect(input.nodes[0].data.enrichment).toBe('pending');
    expect(output.edges).toBe(input.edges);
    expect(output.nodes).not.toBe(input.nodes);
  });

  it('sin ids listos devuelve los mismos nodos y las mismas `edges`', () => {
    const input = structure();

    const output = mergeEnrichedNodes(input, new Set<string>(), readyData);

    expect(output.nodes).toEqual(input.nodes);
    expect(output.nodes[0]).toBe(input.nodes[0]);
    expect(output.edges).toBe(input.edges);
  });
});
