import { describe, expect, it } from 'vitest';
import { UNAVAILABLE, formatDuration } from '../formatDuration';

describe('formatDuration', () => {
  it('returns unavailable for null/undefined/NaN/negative', () => {
    expect(formatDuration(null)).toBe(UNAVAILABLE);
    expect(formatDuration(undefined)).toBe(UNAVAILABLE);
    expect(formatDuration(Number.NaN)).toBe(UNAVAILABLE);
    expect(formatDuration(-1)).toBe(UNAVAILABLE);
  });

  it('formats milliseconds below a second', () => {
    expect(formatDuration(850)).toBe('850ms');
  });

  it('formats seconds and minutes', () => {
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(83_000)).toBe('1m 23s');
  });

  it('formats hours', () => {
    expect(formatDuration(3_720_000)).toBe('1h 2m');
  });
});
