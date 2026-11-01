import { describe, expect, it } from 'vitest';
import { buildSession } from '../../specs/fixtures';
import {
  buildSessionsEyebrow,
  countRunningSessions,
  isLiveNodeStatus,
  isSessionRunning,
  sessionDurationMs,
} from '../sessionRow';

describe('sessionRow', () => {
  it('treats busy and retry as running, idle and missing as not', () => {
    expect(isSessionRunning({ type: 'busy' })).toBe(true);
    expect(
      isSessionRunning({ type: 'retry', attempt: 1, message: 'x', next: 0 }),
    ).toBe(true);
    expect(isSessionRunning({ type: 'idle' })).toBe(false);
    expect(isSessionRunning(undefined)).toBe(false);
  });

  it('lights the LED only for live node statuses', () => {
    expect(isLiveNodeStatus('running')).toBe(true);
    expect(isLiveNodeStatus('retrying')).toBe(true);
    expect(isLiveNodeStatus('compacting')).toBe(true);
    expect(isLiveNodeStatus('succeeded')).toBe(false);
    expect(isLiveNodeStatus('waiting-permission')).toBe(false);
  });

  it('computes the duration from creation to last activity', () => {
    expect(
      sessionDurationMs(buildSession({ created: 1_000, updated: 61_000 })),
    ).toBe(60_000);
  });

  it('returns null duration when a time bound is missing', () => {
    const session = buildSession();
    const broken = {
      ...session,
      time: { created: null, updated: 5 },
    } as unknown as typeof session;
    expect(sessionDurationMs(broken)).toBeNull();
  });

  it('counts only the running sessions of the list', () => {
    expect(
      countRunningSessions(['a', 'b', 'c'], {
        a: { type: 'busy' },
        b: { type: 'idle' },
      }),
    ).toBe(1);
    expect(countRunningSessions(['a'], undefined)).toBe(0);
  });

  it('builds the eyebrow with the running segment only when there is one', () => {
    expect(buildSessionsEyebrow({ running: 3, total: 12 })).toBe(
      '3 en curso · 12 sesiones',
    );
    expect(buildSessionsEyebrow({ running: 0, total: 12 })).toBe('12 sesiones');
    expect(buildSessionsEyebrow({ running: 1, total: 1 })).toBe(
      '1 en curso · 1 sesión',
    );
  });
});
