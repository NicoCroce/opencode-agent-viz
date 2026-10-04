import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChainSelection } from '../useChainSelection';

describe('useChainSelection', () => {
  it('starts without explicit selection and inspects the root node', () => {
    const { result } = renderHook(() => useChainSelection('root-1'));

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.isChainMode).toBe(false);
    expect(result.current.inspectedNodeId).toBe('root-1');
  });

  it('selectNode enables chain mode and inspects the selected node', () => {
    const { result } = renderHook(() => useChainSelection('root-1'));

    act(() => result.current.selectNode('node-2'));

    expect(result.current.selectedNodeId).toBe('node-2');
    expect(result.current.isChainMode).toBe(true);
    expect(result.current.inspectedNodeId).toBe('node-2');
  });

  it('clearSelection disables chain mode and falls back to the root node', () => {
    const { result } = renderHook(() => useChainSelection('root-1'));

    act(() => result.current.selectNode('node-2'));
    act(() => result.current.clearSelection());

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.isChainMode).toBe(false);
    expect(result.current.inspectedNodeId).toBe('root-1');
  });

  it('inspects null when there is neither selection nor root', () => {
    const { result } = renderHook(() => useChainSelection(null));

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.isChainMode).toBe(false);
    expect(result.current.inspectedNodeId).toBeNull();
  });

  it('resets the selection when rootId changes', () => {
    const { result, rerender } = renderHook(
      ({ rootId }: { rootId: string | null }) => useChainSelection(rootId),
      { initialProps: { rootId: 'root-1' } },
    );

    act(() => result.current.selectNode('node-2'));
    expect(result.current.isChainMode).toBe(true);

    rerender({ rootId: 'root-2' });

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.isChainMode).toBe(false);
    expect(result.current.inspectedNodeId).toBe('root-2');
  });

  it('keeps the selection when rootId stays the same', () => {
    const { result, rerender } = renderHook(
      ({ rootId }: { rootId: string | null }) => useChainSelection(rootId),
      { initialProps: { rootId: 'root-1' } },
    );

    act(() => result.current.selectNode('node-2'));
    rerender({ rootId: 'root-1' });

    expect(result.current.selectedNodeId).toBe('node-2');
    expect(result.current.isChainMode).toBe(true);
  });
});
