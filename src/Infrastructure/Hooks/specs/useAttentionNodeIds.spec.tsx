import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { attentionItem } from '../../lib/specs/fixtures';
import { useAttentionNodeIds } from '../useAttentionNodeIds';

/**
 * `useAttentionNodeIds` es la pieza que deriva el `Set` de nodos a realzar de la
 * **única fuente** de atención (FR-007). El caso negativo (ítem sin nodo en el
 * subárbol) no realza nada, y la memoización se ancla a la identidad de
 * `attention` para no recrear el `Set` ni forzar re-renders del contexto del
 * nodo (FR-019).
 */
describe('useAttentionNodeIds — realce por nodo (FR-007)', () => {
  it('deriva el Set de nodeIds de los ítems con nodo', () => {
    const attention = [
      attentionItem({ id: 'a', sessionId: 's1', nodeId: 'n1' }),
      attentionItem({ id: 'b', sessionId: 's2', nodeId: 'n2' }),
    ];

    const { result } = renderHook(() => useAttentionNodeIds(attention));

    expect([...result.current]).toEqual(['n1', 'n2']);
  });

  it('descarta los ítems sin nodo (nodeId === null)', () => {
    const attention = [
      attentionItem({ id: 'a', sessionId: 's1', nodeId: null }),
      attentionItem({ id: 'b', sessionId: 's2', nodeId: 'n2' }),
    ];

    const { result } = renderHook(() => useAttentionNodeIds(attention));

    expect(result.current.has('n2')).toBe(true);
    expect(result.current.size).toBe(1);
  });

  it('devuelve un Set vacío sin atención', () => {
    const { result } = renderHook(() => useAttentionNodeIds([]));

    expect(result.current.size).toBe(0);
  });

  it('deduplica nodeIds repetidos', () => {
    const attention = [
      attentionItem({ id: 'a', sessionId: 's1', nodeId: 'n1' }),
      attentionItem({ id: 'b', sessionId: 's1', nodeId: 'n1' }),
    ];

    const { result } = renderHook(() => useAttentionNodeIds(attention));

    expect(result.current.size).toBe(1);
    expect(result.current.has('n1')).toBe(true);
  });

  it('conserva la identidad del Set mientras attention no cambie', () => {
    const attention = [attentionItem({ id: 'a', sessionId: 's1', nodeId: 'n1' })];
    const { result, rerender } = renderHook(
      (items: Parameters<typeof useAttentionNodeIds>[0]) =>
        useAttentionNodeIds(items),
      { initialProps: attention },
    );

    const first = result.current;
    rerender(attention);

    expect(result.current).toBe(first);
  });

  it('recalcula el Set cuando cambia la identidad de attention', () => {
    const base = attentionItem({ id: 'a', sessionId: 's1', nodeId: 'n1' });
    const { result, rerender } = renderHook(
      (items: Parameters<typeof useAttentionNodeIds>[0]) =>
        useAttentionNodeIds(items),
      { initialProps: [base] },
    );

    const first = result.current;
    rerender([base]);

    expect(result.current).not.toBe(first);
    expect([...result.current]).toEqual(['n1']);
  });
});
