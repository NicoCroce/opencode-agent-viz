import { describe, expect, it } from 'vitest';
import type { TQuestionState } from '../questionState';
import { QUESTION_STATE_COLOR, QUESTION_STATE_LABEL } from '../questionState';

const ALL_STATES: TQuestionState[] = ['pending', 'answered', 'cancelled'];

describe('QUESTION_STATE_LABEL', () => {
  it('covers exactly the 3 question states', () => {
    expect(Object.keys(QUESTION_STATE_LABEL).sort()).toEqual(
      [...ALL_STATES].sort(),
    );
  });

  it('labels pending, answered and cancelled', () => {
    expect(QUESTION_STATE_LABEL).toEqual({
      pending: 'pendiente',
      answered: 'respondida',
      cancelled: 'cancelada',
    });
  });
});

describe('QUESTION_STATE_COLOR', () => {
  it('covers exactly the 3 question states', () => {
    expect(Object.keys(QUESTION_STATE_COLOR).sort()).toEqual(
      [...ALL_STATES].sort(),
    );
  });

  it('uses running for pending, done for answered and muted for cancelled', () => {
    expect(QUESTION_STATE_COLOR).toEqual({
      pending: 'text-status-running',
      answered: 'text-status-done',
      cancelled: 'text-muted-foreground',
    });
  });
});
