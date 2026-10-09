import { describe, expect, it } from 'vitest';
import type { TNodeStatus } from '../../Graph.entity';
import { nodeStatusRank, worseNodeStatus } from '../nodeStatusRank';

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

describe('nodeStatusRank', () => {
  it('ranks every state exactly once', () => {
    expect(Object.keys(nodeStatusRank).sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
    expect(new Set(Object.values(nodeStatusRank)).size).toBe(9);
  });

  it('weights every active state above every terminal one', () => {
    const active = [
      'waiting-permission',
      'waiting-input',
      'running',
      'retrying',
      'compacting',
    ] as const;
    const terminal = [
      'created',
      'succeeded',
      'interrupted',
      'failed',
    ] as const;

    for (const a of active) {
      for (const t of terminal) {
        expect(nodeStatusRank[a]).toBeGreaterThan(nodeStatusRank[t]);
      }
    }
  });

  it('orders the terminal states created < succeeded < interrupted < failed', () => {
    expect(nodeStatusRank.created).toBeLessThan(nodeStatusRank.succeeded);
    expect(nodeStatusRank.succeeded).toBeLessThan(nodeStatusRank.interrupted);
    expect(nodeStatusRank.interrupted).toBeLessThan(nodeStatusRank.failed);
  });

  it('orders the active states waiting < running < retrying < compacting', () => {
    expect(nodeStatusRank['waiting-permission']).toBeLessThan(
      nodeStatusRank['waiting-input'],
    );
    expect(nodeStatusRank['waiting-input']).toBeLessThan(
      nodeStatusRank.running,
    );
    expect(nodeStatusRank.running).toBeLessThan(nodeStatusRank.retrying);
    expect(nodeStatusRank.retrying).toBeLessThan(nodeStatusRank.compacting);
  });
});

describe('worseNodeStatus', () => {
  it('returns the candidate when there is no current status', () => {
    expect(worseNodeStatus(undefined, 'running')).toBe('running');
  });

  it('keeps the current when it ranks higher', () => {
    expect(worseNodeStatus('failed', 'succeeded')).toBe('failed');
  });

  it('replaces the current with a worse candidate', () => {
    expect(worseNodeStatus('succeeded', 'failed')).toBe('failed');
  });

  it('keeps the current on a tie', () => {
    expect(worseNodeStatus('running', 'running')).toBe('running');
  });
});
