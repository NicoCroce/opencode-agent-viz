import { describe, expect, it } from 'vitest';
import { isTerminalOutcome, OUTCOME_LABEL } from '../outcomeLabel';

describe('OUTCOME_LABEL', () => {
  it('labels the three terminal outcomes', () => {
    expect(OUTCOME_LABEL).toEqual({
      succeeded: 'Terminada con éxito',
      failed: 'Fallida',
      interrupted: 'Interrumpida',
    });
  });
});

describe('isTerminalOutcome', () => {
  it.each(['succeeded', 'failed', 'interrupted'] as const)(
    'accepts the terminal status %s',
    (status) => {
      expect(isTerminalOutcome(status)).toBe(true);
    },
  );

  it.each([
    'created',
    'running',
    'retrying',
    'compacting',
    'waiting-permission',
    'waiting-input',
  ] as const)('rejects the non-terminal status %s', (status) => {
    expect(isTerminalOutcome(status)).toBe(false);
  });
});
