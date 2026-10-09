import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { NodeChange } from '@xyflow/react';
import type { TGraphNode } from '../../Graph.entity';
import { useNodeResize } from '../useNodeResize';

const resizeChanges = (id: string): NodeChange<TGraphNode>[] => [
  {
    id,
    type: 'dimensions',
    dimensions: { width: 640, height: 200 },
    resizing: true,
  },
  {
    id,
    type: 'position',
    position: { x: 40, y: 30 },
  },
];

describe('useNodeResize', () => {
  it('delegates onNodesChange to reduceNodeOverrides', () => {
    const { result } = renderHook(() => useNodeResize('session-a'));

    expect(result.current.overrides).toEqual({});

    act(() => result.current.onNodesChange(resizeChanges('node-1')));

    expect(result.current.overrides['node-1']).toMatchObject({
      width: 640,
      height: 200,
      x: 40,
      y: 30,
    });
  });

  it('ignores non-resize changes such as selection', () => {
    const { result } = renderHook(() => useNodeResize('session-a'));

    act(() =>
      result.current.onNodesChange([
        { id: 'node-1', type: 'select', selected: true },
      ]),
    );

    expect(result.current.overrides).toEqual({});
  });

  it('keeps the overrides reference on automatic measurement (no re-render)', () => {
    const { result } = renderHook(() => useNodeResize('session-a'));

    const before = result.current.overrides;

    act(() =>
      result.current.onNodesChange([
        {
          id: 'node-1',
          type: 'dimensions',
          dimensions: { width: 220, height: 96 },
        },
      ]),
    );

    // React Flow mide los nodos en el montaje y emite una `dimensions` sin
    // `resizing`: no debe producir un re-render (FR-002), o los nodos quedarían
    // ocultos al resetearse sus dimensiones medidas.
    expect(result.current.overrides).toBe(before);
  });

  it('clears overrides when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps: { resetKey: 'session-a' } },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-1')));
    expect(result.current.overrides['node-1']).toBeDefined();

    rerender({ resetKey: 'session-b' });

    expect(result.current.overrides).toEqual({});
  });

  it('keeps overrides when resetKey stays the same', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps: { resetKey: 'session-a' } },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-1')));
    rerender({ resetKey: 'session-a' });

    expect(result.current.overrides['node-1']).toBeDefined();
  });
});

/**
 * Paridad de resize al cambiar de sesión (FR-007, SC-006; escenario 3 de la
 * Historia 4): el tamaño/posición elegido por el usuario no se filtra entre
 * sesiones y, al volver a una sesión ya visitada, el reseteo se comporta como
 * hoy (el estado de vista no persiste por sesión).
 */
describe('useNodeResize — paridad de resize al cambiar de sesión (FR-007)', () => {
  it('clears both the resized dimensions and the position on a session change', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps: { resetKey: 'session-a' } },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-1')));
    expect(result.current.overrides['node-1']).toMatchObject({
      width: 640,
      height: 200,
      x: 40,
      y: 30,
    });

    rerender({ resetKey: 'session-b' });

    expect(result.current.overrides).toEqual({});
    expect(result.current.overrides['node-1']).toBeUndefined();
  });

  it('does not leak the previous session sizes into the new session', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps: { resetKey: 'session-a' } },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-a')));
    rerender({ resetKey: 'session-b' });
    act(() => result.current.onNodesChange(resizeChanges('node-b')));

    expect(result.current.overrides['node-b']).toBeDefined();
    expect(result.current.overrides['node-a']).toBeUndefined();
    expect(Object.keys(result.current.overrides)).toEqual(['node-b']);
  });

  it('does not restore the previous sizes when returning to a visited session', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps: { resetKey: 'session-a' } },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-1')));
    rerender({ resetKey: 'session-b' });
    rerender({ resetKey: 'session-a' });

    // Igual que hoy: al volver a una sesión visitada no se restaura su resize.
    expect(result.current.overrides).toEqual({});
  });

  it('keeps the reset override map stable while staying in the same session', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps: { resetKey: 'session-a' } },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-1')));
    rerender({ resetKey: 'session-b' });
    const afterReset = result.current.overrides;
    rerender({ resetKey: 'session-b' });

    expect(result.current.overrides).toBe(afterReset);
  });

  it('clears overrides when the reset key becomes null', () => {
    const initialProps: { resetKey: string | null } = { resetKey: 'session-a' };
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string | null }) => useNodeResize(resetKey),
      { initialProps },
    );

    act(() => result.current.onNodesChange(resizeChanges('node-1')));
    rerender({ resetKey: null });

    expect(result.current.overrides).toEqual({});
  });
});
