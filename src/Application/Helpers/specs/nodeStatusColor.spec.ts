import { describe, expect, it } from 'vitest';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import { NODE_STATUS_COLOR } from '../nodeStatusColor';

const ALL_STATUSES: TNodeStatus[] = [
  'created',
  'running',
  'retrying',
  'compacting',
  'waiting-permission',
  'waiting-input',
  'succeeded',
  'failed',
  'interrupted',
];

describe('NODE_STATUS_COLOR', () => {
  it('covers exactly the 9 execution states', () => {
    expect(Object.keys(NODE_STATUS_COLOR).sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
  });

  it('maps every state to a bg-status-* token', () => {
    for (const status of ALL_STATUSES) {
      expect(NODE_STATUS_COLOR[status]).toMatch(/^bg-status-/);
    }
  });

  it('shares the running tone across retrying and compacting', () => {
    expect(NODE_STATUS_COLOR.running).toBe('bg-status-running');
    expect(NODE_STATUS_COLOR.retrying).toBe('bg-status-running');
    expect(NODE_STATUS_COLOR.compacting).toBe('bg-status-running');
  });

  it('shares the waiting tone across both waits', () => {
    expect(NODE_STATUS_COLOR['waiting-permission']).toBe('bg-status-waiting');
    expect(NODE_STATUS_COLOR['waiting-input']).toBe('bg-status-waiting');
  });

  it('uses idle, done and error tones for the terminal states', () => {
    expect(NODE_STATUS_COLOR.created).toBe('bg-status-idle');
    expect(NODE_STATUS_COLOR.succeeded).toBe('bg-status-done');
    expect(NODE_STATUS_COLOR.failed).toBe('bg-status-error');
    expect(NODE_STATUS_COLOR.interrupted).toBe('bg-status-error');
  });
});
