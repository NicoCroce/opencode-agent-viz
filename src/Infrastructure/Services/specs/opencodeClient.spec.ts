import { describe, expect, it } from 'vitest';
import { opencodeService } from '../opencodeClient';

const FORBIDDEN = [
  'prompt',
  'abort',
  'command',
  'shell',
  'revert',
  'unrevert',
  'create',
  'update',
  'delete',
  'share',
  'unshare',
  'fork',
  'init',
  'summarize',
  'respondPermission',
];

describe('opencodeService', () => {
  it('exposes only read-only operations (FR-016)', () => {
    for (const method of FORBIDDEN) {
      expect(opencodeService).not.toHaveProperty(method);
    }
  });

  it('exposes the required read operations', () => {
    expect(typeof opencodeService.listSessions).toBe('function');
    expect(typeof opencodeService.getSessionMessages).toBe('function');
    expect(typeof opencodeService.subscribeEvents).toBe('function');
  });
});
