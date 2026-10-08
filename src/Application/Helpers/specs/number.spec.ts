import { describe, expect, it } from 'vitest';
import { sumNullable } from '../number';

describe('sumNullable', () => {
  it('returns null for an empty list', () => {
    expect(sumNullable([])).toBeNull();
  });

  it('returns null when every value is null', () => {
    expect(sumNullable([null, null])).toBeNull();
  });

  it('sums the present values ignoring the nulls', () => {
    expect(sumNullable([1, null, 2, null, 3])).toBe(6);
  });

  it('keeps zero as data', () => {
    expect(sumNullable([0, 0])).toBe(0);
  });

  it('returns the single present value', () => {
    expect(sumNullable([42])).toBe(42);
  });

  it('does not mutate the input', () => {
    const values = [1, null, 2];

    sumNullable(values);

    expect(values).toEqual([1, null, 2]);
  });
});
