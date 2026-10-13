import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ModelRef } from '@opencode/client';
import type { TGraphNode } from '@app/Domains/Graph';
import { useChatSelectionSeed } from '../useChatSelectionSeed';

/**
 * `useChatSelectionSeed` es la semilla de la selección activa del chat (FR-008):
 * del **nodo abierto** (`data.sessionId === sessionId`) toma `agentName` y
 * `model`. Sin nodo (o sin sesión) ambos son `null` = "no cambiar", de modo que
 * `useChatController` solo aplica `switch*` cuando el nodo trae valores.
 */

const MODEL: ModelRef = {
  id: 'claude-sonnet-4',
  providerID: 'anthropic',
};

/** Nodo mínimo del contrato de datos: la semilla solo lee `sessionId`, `agentName` y `model`. */
const makeNode = (
  sessionId: string,
  agentName: string,
  model: ModelRef | null,
): TGraphNode =>
  ({
    id: sessionId,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: { sessionId, agentName, model },
  }) as unknown as TGraphNode;

describe('useChatSelectionSeed — semilla del nodo abierto (FR-008)', () => {
  it('devuelve agente y modelo del nodo cuya sesión está abierta', () => {
    const nodes = [makeNode('root', 'build', null), makeNode('child', 'develop', MODEL)];

    const { result } = renderHook(() =>
      useChatSelectionSeed({ nodes, sessionId: 'child' }),
    );

    expect(result.current.agent).toBe('develop');
    expect(result.current.model).toBe(MODEL);
  });

  it('sin nodo para la sesión abierta devuelve null/null (no cambiar)', () => {
    const nodes = [makeNode('root', 'build', MODEL)];

    const { result } = renderHook(() =>
      useChatSelectionSeed({ nodes, sessionId: 'otra-sesion' }),
    );

    expect(result.current.agent).toBeNull();
    expect(result.current.model).toBeNull();
  });

  it('sin sesión abierta devuelve null/null aunque haya nodos', () => {
    const nodes = [makeNode('root', 'build', MODEL)];

    const { result } = renderHook(() =>
      useChatSelectionSeed({ nodes, sessionId: null }),
    );

    expect(result.current.agent).toBeNull();
    expect(result.current.model).toBeNull();
  });

  it('preserva la referencia mientras no cambian nodes ni sessionId', () => {
    const nodes = [makeNode('child', 'develop', MODEL)];
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) =>
        useChatSelectionSeed({ nodes, sessionId }),
      { initialProps: { sessionId: 'child' } },
    );

    const first = result.current;
    rerender({ sessionId: 'child' });

    expect(result.current).toBe(first);
  });

  it('recalcula cuando cambia la identidad de nodes', () => {
    const { result, rerender } = renderHook(
      ({ nodes }: { nodes: TGraphNode[] }) =>
        useChatSelectionSeed({ nodes, sessionId: 'child' }),
      { initialProps: { nodes: [makeNode('child', 'develop', MODEL)] } },
    );

    const first = result.current;
    rerender({ nodes: [makeNode('child', 'develop', MODEL)] });

    expect(result.current).not.toBe(first);
    expect(result.current.agent).toBe('develop');
  });
});
