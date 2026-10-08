import { describe, expect, it } from 'vitest';
import { sameQueryKey } from '../queryKey';

describe('sameQueryKey', () => {
  it('is true for equal primitive keys', () => {
    expect(
      sameQueryKey(['sessions', 'detail', 'ses_1'], ['sessions', 'detail', 'ses_1']),
    ).toBe(true);
  });

  it('is true for two empty keys', () => {
    expect(sameQueryKey([], [])).toBe(true);
  });

  it('is false when the lengths differ', () => {
    expect(sameQueryKey(['sessions'], ['sessions', 'list'])).toBe(false);
    expect(sameQueryKey(['sessions', 'list'], ['sessions'])).toBe(false);
  });

  it('is false when any element differs', () => {
    expect(sameQueryKey(['sessions', 'a'], ['sessions', 'b'])).toBe(false);
  });

  it('compares elements by identity, not by value', () => {
    const ref = { page: 1 };
    expect(sameQueryKey([ref], [ref])).toBe(true);
    expect(sameQueryKey([{ page: 1 }], [{ page: 1 }])).toBe(false);
  });

  it('distinguishes a number from its string form', () => {
    expect(sameQueryKey([1], ['1'])).toBe(false);
  });
});
