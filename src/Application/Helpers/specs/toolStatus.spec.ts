import { describe, expect, it } from 'vitest';
import type { TToolStatus } from '../toolStatus';
import { TOOL_STATUS_COLOR, TOOL_STATUS_LABEL } from '../toolStatus';

const ALL_STATUSES: TToolStatus[] = [
  'streaming',
  'running',
  'completed',
  'error',
  'pending',
];

describe('TOOL_STATUS_LABEL', () => {
  it('covers exactly the 5 tool statuses', () => {
    expect(Object.keys(TOOL_STATUS_LABEL).sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
  });

  it('labels each status without inventing an outcome', () => {
    expect(TOOL_STATUS_LABEL).toEqual({
      streaming: 'En curso',
      running: 'Ejecutando',
      completed: 'Completada',
      error: 'Fallida',
      pending: 'Pendiente',
    });
  });
});

describe('TOOL_STATUS_COLOR', () => {
  it('covers exactly the 5 tool statuses', () => {
    expect(Object.keys(TOOL_STATUS_COLOR).sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
  });

  it('maps every status to a text-status-* token', () => {
    for (const status of ALL_STATUSES) {
      expect(TOOL_STATUS_COLOR[status]).toMatch(/^text-status-/);
    }
  });

  it('gives streaming and pending an explicit color', () => {
    expect(TOOL_STATUS_COLOR.streaming).toBe('text-status-running');
    expect(TOOL_STATUS_COLOR.pending).toBe('text-status-idle');
  });

  it('shares the running tone and keeps done/error distinct', () => {
    expect(TOOL_STATUS_COLOR.running).toBe('text-status-running');
    expect(TOOL_STATUS_COLOR.completed).toBe('text-status-done');
    expect(TOOL_STATUS_COLOR.error).toBe('text-status-error');
  });
});
