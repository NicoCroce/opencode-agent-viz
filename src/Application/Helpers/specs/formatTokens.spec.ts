import { describe, expect, it } from 'vitest';
import { UNAVAILABLE } from '../formatDuration';
import { formatTokens } from '../formatTokens';

describe('formatTokens', () => {
  it('returns unavailable for null/undefined/NaN', () => {
    expect(formatTokens(null)).toBe(UNAVAILABLE);
    expect(formatTokens(undefined)).toBe(UNAVAILABLE);
    expect(formatTokens(Number.NaN)).toBe(UNAVAILABLE);
  });

  it('formats raw counts below 1000', () => {
    expect(formatTokens(523)).toBe('523');
  });

  it('formats thousands and millions', () => {
    expect(formatTokens(12_400)).toBe('12.4k');
    expect(formatTokens(2_500_000)).toBe('2.5M');
  });
});
