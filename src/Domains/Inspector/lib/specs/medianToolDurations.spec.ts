import { describe, expect, it } from 'vitest';
import type { TToolHistoryEntry } from '../../Inspector.entity';
import { medianToolDurations } from '../medianToolDurations';

const tool = (
  overrides: Partial<TToolHistoryEntry> = {},
): TToolHistoryEntry => ({
  name: 'read',
  status: 'completed',
  startedAt: 0,
  endedAt: 1000,
  ...overrides,
});

describe('medianToolDurations', () => {
  it('returns no statistics without tools', () => {
    expect(medianToolDurations([])).toEqual([]);
  });

  it('aggregates a single tool with its call count and duration', () => {
    const stats = medianToolDurations([tool({ name: 'read', endedAt: 400 })]);

    expect(stats).toEqual([{ name: 'read', calls: 1, medianMs: 400 }]);
  });

  it('groups several tools preserving their first-appearance order', () => {
    const stats = medianToolDurations([
      tool({ name: 'read', endedAt: 400 }),
      tool({ name: 'bash', startedAt: 0, endedAt: 200 }),
      tool({ name: 'read', startedAt: 0, endedAt: 600 }),
    ]);

    expect(stats.map((stat) => stat.name)).toEqual(['read', 'bash']);
    expect(stats[0]).toEqual({ name: 'read', calls: 2, medianMs: 500 });
    expect(stats[1]).toEqual({ name: 'bash', calls: 1, medianMs: 200 });
  });

  it('computes the median for an odd number of durations', () => {
    const stats = medianToolDurations([
      tool({ endedAt: 300 }),
      tool({ endedAt: 100 }),
      tool({ endedAt: 200 }),
    ]);

    expect(stats[0].medianMs).toBe(200);
  });

  it('computes the median for an even number of durations', () => {
    const stats = medianToolDurations([
      tool({ endedAt: 100 }),
      tool({ endedAt: 200 }),
      tool({ endedAt: 300 }),
      tool({ endedAt: 500 }),
    ]);

    expect(stats[0].medianMs).toBe(250);
  });

  it('counts executions missing times but excludes them from the median', () => {
    const stats = medianToolDurations([
      tool({ endedAt: 400 }),
      tool({ startedAt: undefined, endedAt: undefined, status: 'running' }),
      tool({ startedAt: 0, endedAt: 600 }),
    ]);

    expect(stats[0]).toEqual({ name: 'read', calls: 3, medianMs: 500 });
  });

  it('reports a null median when no execution has both times', () => {
    const stats = medianToolDurations([
      tool({ startedAt: undefined, endedAt: undefined, status: 'running' }),
      tool({ startedAt: 0, endedAt: undefined, status: 'running' }),
    ]);

    expect(stats[0]).toEqual({ name: 'read', calls: 2, medianMs: null });
  });

  it('does not mutate the input order', () => {
    const first = tool({ name: 'read' });
    const second = tool({ name: 'bash' });
    const input = [first, second];

    medianToolDurations(input);

    expect(input[0]).toBe(first);
    expect(input[1]).toBe(second);
  });
});
