import { describe, expect, it } from 'vitest';
import { UNAVAILABLE } from '../formatDuration';
import { formatCost } from '../formatCost';

describe('formatCost', () => {
  it('returns unavailable for null/undefined/NaN', () => {
    expect(formatCost(null)).toBe(UNAVAILABLE);
    expect(formatCost(undefined)).toBe(UNAVAILABLE);
    expect(formatCost(Number.NaN)).toBe(UNAVAILABLE);
  });

  it('formats sub-cent precision', () => {
    expect(formatCost(0.0123)).toBe('$0.0123');
  });

  it('formats regular amounts with two decimals', () => {
    expect(formatCost(1.5)).toBe('$1.50');
  });

  it('keeps an explicit zero as zero (not unavailable)', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('respects a custom currency symbol', () => {
    expect(formatCost(2, '€')).toBe('€2.00');
  });
});
