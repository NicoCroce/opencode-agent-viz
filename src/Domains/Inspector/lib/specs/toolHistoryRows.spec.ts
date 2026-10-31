import { describe, expect, it } from 'vitest';
import type { TToolHistoryEntry } from '../../Inspector.entity';
import { toolHistoryRows } from '../toolHistoryRows';

const tool = (
  overrides: Partial<TToolHistoryEntry> = {},
): TToolHistoryEntry => ({
  name: 'read',
  status: 'completed',
  startedAt: 0,
  endedAt: 1000,
  ...overrides,
});

describe('toolHistoryRows', () => {
  it('returns no rows without tools', () => {
    expect(toolHistoryRows([])).toEqual([]);
  });

  it('derives the duration and its ratio against the slowest call', () => {
    const rows = toolHistoryRows([
      tool({ name: 'bash', endedAt: 4000 }),
      tool({ name: 'read', endedAt: 1000 }),
    ]);

    expect(rows.map((row) => row.durationMs)).toEqual([4000, 1000]);
    expect(rows.map((row) => row.ratio)).toEqual([1, 0.25]);
  });

  it('highlights only the first slowest call', () => {
    const rows = toolHistoryRows([
      tool({ name: 'a', endedAt: 500 }),
      tool({ name: 'b', endedAt: 2000 }),
      tool({ name: 'c', endedAt: 2000 }),
    ]);

    expect(rows.map((row) => row.isHighlighted)).toEqual([false, true, false]);
  });

  it('always highlights calls still in progress', () => {
    const rows = toolHistoryRows([
      tool({ name: 'slow', endedAt: 3000 }),
      tool({ name: 'live', status: 'running', endedAt: undefined }),
    ]);

    expect(rows[1].durationMs).toBeNull();
    expect(rows[1].ratio).toBe(0);
    expect(rows.map((row) => row.isHighlighted)).toEqual([true, true]);
  });

  it('does not highlight by slowness when no call has a measurable duration', () => {
    const rows = toolHistoryRows([
      tool({ startedAt: undefined, endedAt: undefined }),
      tool({ startedAt: 10, endedAt: 10 }),
    ]);

    expect(rows.map((row) => row.isHighlighted)).toEqual([false, false]);
    expect(rows.map((row) => row.ratio)).toEqual([0, 0]);
  });

  it('preserves the input order', () => {
    const rows = toolHistoryRows([
      tool({ name: 'first' }),
      tool({ name: 'second' }),
    ]);

    expect(rows.map((row) => row.entry.name)).toEqual(['first', 'second']);
  });
});
