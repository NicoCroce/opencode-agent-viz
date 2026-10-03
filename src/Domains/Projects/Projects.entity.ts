import type { Project } from '@opencode/client';

export type TProject = Project;

const GLOBAL_WORKTREE = '/';

/**
 * V2 renombró `Project.worktree` a `Project.canonical`, y cada proyecto puede
 * tener además directorios sandbox. OpenCode expone un proyecto "global" con
 * worktree `/` que no corresponde a ninguna carpeta real; lo excluimos del
 * universo de proyectos observables.
 */
export const projectDirectories = (projects: TProject[]): string[] => {
  const directories = new Set<string>();
  for (const project of projects) {
    const candidates = [project.canonical, ...(project.sandboxes ?? [])];
    for (const directory of candidates) {
      if (!directory || directory === GLOBAL_WORKTREE) continue;
      directories.add(directory);
    }
  }
  return [...directories];
};
