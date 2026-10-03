import { describe, expect, it } from 'vitest';
import { folderName } from '../folderName';

describe('folderName', () => {
  it('returns the last path segment', () => {
    expect(folderName('/Users/nicocroce/Personal/opencode-agent-viz')).toBe(
      'opencode-agent-viz',
    );
  });

  it('ignores trailing slashes', () => {
    expect(folderName('/repo/proj/')).toBe('proj');
  });

  it('falls back when directory is missing', () => {
    expect(folderName(null)).toBe('Sin carpeta');
    expect(folderName(undefined)).toBe('Sin carpeta');
    expect(folderName('')).toBe('Sin carpeta');
  });
});
