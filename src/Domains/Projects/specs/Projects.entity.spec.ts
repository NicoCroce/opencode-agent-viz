import { describe, expect, it } from 'vitest';
import type { Project } from '@opencode/client';
import { projectDirectories } from '../Projects.entity';

const project = (
  canonical: string,
  id = canonical,
  sandboxes: string[] = [],
): Project => ({
  id,
  canonical,
  time: { created: 1, updated: 1, active: 1 },
  sandboxes,
});

describe('projectDirectories', () => {
  it('keeps real directories and drops the global root project', () => {
    const directories = projectDirectories([
      project('/'),
      project('/repo-a'),
      project('/repo-b'),
    ]);
    expect(directories).toEqual(['/repo-a', '/repo-b']);
  });

  it('dedupes directories that appear more than once', () => {
    expect(
      projectDirectories([project('/repo-a', 'x'), project('/repo-a', 'y')]),
    ).toEqual(['/repo-a']);
  });

  it('includes sandbox directories', () => {
    expect(
      projectDirectories([project('/repo-a', 'x', ['/repo-a/.sandbox'])]),
    ).toEqual(['/repo-a', '/repo-a/.sandbox']);
  });

  it('ignores empty directories', () => {
    expect(projectDirectories([project('')])).toEqual([]);
  });
});
