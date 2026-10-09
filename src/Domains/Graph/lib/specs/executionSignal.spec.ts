import { describe, expect, it } from 'vitest';
import type { TExecutionSignal } from '../../Graph.entity';
import {
  EMPTY_EXECUTION_SIGNAL,
  mergeExecutionSignals,
  normalizeSignal,
  sameExecutionSignal,
} from '../executionSignal';

const signal = (
  overrides: Partial<TExecutionSignal> = {},
): TExecutionSignal => ({
  retry: null,
  compaction: null,
  outcome: null,
  interruptReason: null,
  ...overrides,
});

describe('EMPTY_EXECUTION_SIGNAL', () => {
  it('is null in every field', () => {
    expect(EMPTY_EXECUTION_SIGNAL).toEqual({
      retry: null,
      compaction: null,
      outcome: null,
      interruptReason: null,
    });
  });
});

describe('normalizeSignal', () => {
  it('keeps the present values untouched', () => {
    const value = signal({
      retry: { attempt: 2, next: 5 },
      compaction: 'completed',
      outcome: 'failed',
      interruptReason: 'user',
    });

    expect(normalizeSignal(value)).toEqual(value);
  });

  it('turns missing fields into null', () => {
    const partial = {
      retry: undefined,
      compaction: undefined,
      outcome: undefined,
      interruptReason: undefined,
    } as unknown as TExecutionSignal;

    expect(normalizeSignal(partial)).toEqual(EMPTY_EXECUTION_SIGNAL);
  });
});

describe('mergeExecutionSignals', () => {
  it('returns the seed when there is no live signal', () => {
    const seed = signal({ outcome: 'succeeded' });

    expect(mergeExecutionSignals(seed, undefined)).toEqual(seed);
  });

  it('lets the live fields win over the seed', () => {
    const seed = signal({
      outcome: 'failed',
      compaction: 'completed',
      interruptReason: 'seed',
    });
    const live = signal({ outcome: 'succeeded', compaction: 'running' });

    expect(mergeExecutionSignals(seed, live)).toEqual({
      retry: null,
      compaction: 'running',
      outcome: 'succeeded',
      interruptReason: 'seed',
    });
  });

  it('fills the live gaps from the seed', () => {
    const seed = signal({ compaction: 'completed', interruptReason: 'timeout' });
    const live = signal({ outcome: 'interrupted' });

    expect(mergeExecutionSignals(seed, live)).toEqual({
      retry: null,
      compaction: 'completed',
      outcome: 'interrupted',
      interruptReason: 'timeout',
    });
  });

  it('treats a null live field as absent and falls back to the seed', () => {
    const seed = signal({ retry: { attempt: 1, next: null } });
    const live = signal({ retry: null });

    expect(mergeExecutionSignals(seed, live).retry).toEqual({
      attempt: 1,
      next: null,
    });
  });
});

describe('sameExecutionSignal', () => {
  it('is true for structurally equal signals', () => {
    expect(
      sameExecutionSignal(signal({ outcome: 'failed' }), signal({ outcome: 'failed' })),
    ).toBe(true);
  });

  it('is false when the outcome differs', () => {
    expect(
      sameExecutionSignal(signal({ outcome: 'failed' }), signal({ outcome: 'succeeded' })),
    ).toBe(false);
  });

  it('is false when compaction or interruptReason differ', () => {
    expect(
      sameExecutionSignal(signal({ compaction: 'running' }), signal({ compaction: 'completed' })),
    ).toBe(false);
    expect(
      sameExecutionSignal(signal({ interruptReason: 'a' }), signal({ interruptReason: 'b' })),
    ).toBe(false);
  });

  it('compares retry by attempt and next', () => {
    expect(
      sameExecutionSignal(
        signal({ retry: { attempt: 2, next: 5 } }),
        signal({ retry: { attempt: 2, next: 5 } }),
      ),
    ).toBe(true);
    expect(
      sameExecutionSignal(
        signal({ retry: { attempt: 2, next: 5 } }),
        signal({ retry: { attempt: 3, next: 5 } }),
      ),
    ).toBe(false);
    expect(
      sameExecutionSignal(
        signal({ retry: { attempt: 2, next: null } }),
        signal({ retry: { attempt: 2, next: 9 } }),
      ),
    ).toBe(false);
  });

  it('treats a null retry attempt as absent', () => {
    const withNullAttempt = signal({
      retry: { attempt: null, next: null } as unknown as TExecutionSignal['retry'],
    });

    expect(sameExecutionSignal(signal(), withNullAttempt)).toBe(true);
  });
});
