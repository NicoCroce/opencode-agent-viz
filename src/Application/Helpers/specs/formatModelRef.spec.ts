import { describe, expect, it } from 'vitest';
import type { ModelRef } from '@opencode/client';
import { formatModelRef } from '../formatModelRef';

const model = (providerID: string, id: string): ModelRef => ({
  providerID,
  id,
});

describe('formatModelRef', () => {
  it('joins provider and id with a slash', () => {
    expect(formatModelRef(model('opencode', 'deepseek'))).toBe(
      'opencode/deepseek',
    );
  });

  it('keeps multi-segment ids intact', () => {
    expect(formatModelRef(model('anthropic', 'claude-3.5-sonnet'))).toBe(
      'anthropic/claude-3.5-sonnet',
    );
  });

  it('does not append an optional variant', () => {
    expect(formatModelRef({ providerID: 'p', id: 'm', variant: 'fast' })).toBe(
      'p/m',
    );
  });
});
