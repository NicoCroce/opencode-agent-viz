import { describe, expect, it } from 'vitest';
import { chunkArray } from '../array';

describe('chunkArray', () => {
  it('returns [] for an empty input', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('returns a single chunk when the size matches exactly', () => {
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it('splits with a remainder', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('preserves order with no loss or duplication', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    expect(chunkArray(items, 2).flat()).toEqual(items);
  });

  it('normalizes a non-positive size to 1', () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
    expect(chunkArray([1, 2, 3], -5)).toEqual([[1], [2], [3]]);
  });

  it('floors a fractional size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2.9)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('normalizes a fractional size below 1 to 1 instead of looping forever', () => {
    expect(chunkArray([1, 2, 3], 0.5)).toEqual([[1], [2], [3]]);
  });

  it('normalizes a non-finite size to 1', () => {
    expect(chunkArray([1, 2, 3], Number.NaN)).toEqual([[1], [2], [3]]);
    expect(chunkArray([1, 2, 3], Number.POSITIVE_INFINITY)).toEqual([
      [1],
      [2],
      [3],
    ]);
  });
});
