import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TToolHistoryEntry } from '../../Inspector.entity';
import { useToolHistory } from '../useToolHistory';

// Umbral fijado por el contrato del inspector (`inspector-contract.md`).
const TOOL_HISTORY_LIMIT = 10;

/** Entradas sintéticas con nombre ordenado para detectar inversiones. */
const makeTools = (count: number): TToolHistoryEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `tool-${index + 1}`,
    status: 'completed',
    startedAt: index * 1000,
    endedAt: index * 1000 + 500,
  }));

const names = (entries: TToolHistoryEntry[]): string[] =>
  entries.map((entry) => entry.name);

describe('useToolHistory', () => {
  it('handles an empty history without offering expansion', () => {
    const { result } = renderHook(() => useToolHistory([]));

    expect(result.current.visibleTools).toEqual([]);
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.canExpand).toBe(false);
    expect(result.current.isExpanded).toBe(false);
  });

  it('shows exactly 10 entries without a control at the threshold', () => {
    const tools = makeTools(TOOL_HISTORY_LIMIT);
    const { result } = renderHook(() => useToolHistory(tools));

    expect(result.current.visibleTools).toEqual(tools);
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.canExpand).toBe(false);
  });

  it('shows the first 10 entries and counts the hidden ones with 11 entries', () => {
    const tools = makeTools(TOOL_HISTORY_LIMIT + 1);
    const { result } = renderHook(() => useToolHistory(tools));

    expect(result.current.visibleTools).toEqual(
      tools.slice(0, TOOL_HISTORY_LIMIT),
    );
    expect(result.current.visibleTools).toHaveLength(TOOL_HISTORY_LIMIT);
    expect(result.current.hiddenCount).toBe(1);
    expect(result.current.canExpand).toBe(true);
    expect(result.current.isExpanded).toBe(false);
  });

  it('reports the full hidden count when there are many more entries', () => {
    const tools = makeTools(TOOL_HISTORY_LIMIT + 3);
    const { result } = renderHook(() => useToolHistory(tools));

    expect(result.current.hiddenCount).toBe(3);
    expect(result.current.canExpand).toBe(true);
  });

  it('preserves the chronological order of the input without inverting it', () => {
    const tools = makeTools(TOOL_HISTORY_LIMIT + 2);
    const { result } = renderHook(() => useToolHistory(tools));

    // Las 10 visibles son las más antiguas, en el mismo orden de entrada.
    expect(names(result.current.visibleTools)).toEqual(
      tools.slice(0, TOOL_HISTORY_LIMIT).map((entry) => entry.name),
    );
    expect(result.current.visibleTools[0]).toBe(tools[0]);
    expect(
      result.current.visibleTools[result.current.visibleTools.length - 1],
    ).toBe(tools[TOOL_HISTORY_LIMIT - 1]);
  });

  it('toggle expands to reveal every entry in order', () => {
    const tools = makeTools(TOOL_HISTORY_LIMIT + 2);
    const { result } = renderHook(() => useToolHistory(tools));

    act(() => result.current.toggle());

    expect(result.current.isExpanded).toBe(true);
    expect(result.current.visibleTools).toEqual(tools);
    expect(names(result.current.visibleTools)).toEqual(names(tools));
  });

  it('toggle collapses back to the first 10 entries', () => {
    const tools = makeTools(TOOL_HISTORY_LIMIT + 2);
    const { result } = renderHook(() => useToolHistory(tools));

    act(() => result.current.toggle());
    act(() => result.current.toggle());

    expect(result.current.isExpanded).toBe(false);
    expect(result.current.visibleTools).toEqual(
      tools.slice(0, TOOL_HISTORY_LIMIT),
    );
  });

  it('updates hiddenCount while collapsed and keeps the oldest 10 visible', () => {
    const { result, rerender } = renderHook(
      ({ tools }: { tools: TToolHistoryEntry[] }) => useToolHistory(tools),
      { initialProps: { tools: makeTools(TOOL_HISTORY_LIMIT) } },
    );

    expect(result.current.canExpand).toBe(false);

    const grown = makeTools(TOOL_HISTORY_LIMIT + 1);
    rerender({ tools: grown });

    expect(result.current.isExpanded).toBe(false);
    expect(result.current.canExpand).toBe(true);
    expect(result.current.hiddenCount).toBe(1);
    expect(result.current.visibleTools).toEqual(
      grown.slice(0, TOOL_HISTORY_LIMIT),
    );
  });

  it('does not offer expansion when the history shrinks back to the threshold', () => {
    const { result, rerender } = renderHook(
      ({ tools }: { tools: TToolHistoryEntry[] }) => useToolHistory(tools),
      { initialProps: { tools: makeTools(TOOL_HISTORY_LIMIT + 1) } },
    );

    act(() => result.current.toggle());
    expect(result.current.isExpanded).toBe(true);

    const shrunk = makeTools(TOOL_HISTORY_LIMIT);
    rerender({ tools: shrunk });

    expect(result.current.canExpand).toBe(false);
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.visibleTools).toEqual(shrunk);
  });
});
