import { describe, expect, it } from 'vitest';
import type { TTokenUsage } from '@app/Domains/Graph/Graph.entity';
import { totalTokens } from '../totalTokens';

const tokens = (overrides: Partial<TTokenUsage> = {}): TTokenUsage => ({
  input: null,
  output: null,
  reasoning: null,
  cacheRead: null,
  cacheWrite: null,
  ...overrides,
});

describe('totalTokens', () => {
  it('returns null when there is no token usage', () => {
    expect(totalTokens(null)).toBeNull();
  });

  it('returns null when every component is null', () => {
    expect(totalTokens(tokens())).toBeNull();
  });

  it('sums input, output and reasoning', () => {
    expect(totalTokens(tokens({ input: 100, output: 50, reasoning: 10 }))).toBe(
      160,
    );
  });

  it('ignores the null components', () => {
    expect(totalTokens(tokens({ input: 100, reasoning: 10 }))).toBe(110);
    expect(totalTokens(tokens({ output: 25 }))).toBe(25);
  });

  it('excludes the cache tokens on purpose', () => {
    expect(
      totalTokens(
        tokens({ input: 1, output: 2, reasoning: 3, cacheRead: 1000, cacheWrite: 2000 }),
      ),
    ).toBe(6);
  });

  it('treats zero as data, not as missing', () => {
    expect(totalTokens(tokens({ input: 0, output: 0, reasoning: 0 }))).toBe(0);
  });
});
