import { useMemo } from 'react';
import { projectDirectories } from '../Projects.entity';
import { useGetProjects } from '../Projects.service';

/**
 * Directorios de todos los proyectos observables. Memoizado sobre la data de
 * la query (referencia estable por structural sharing) para no recrear el
 * array en cada render y evitar reinicios de los streams SSE.
 */
export const useProjectDirectories = (): string[] => {
  const query = useGetProjects();
  return useMemo(() => projectDirectories(query.data ?? []), [query.data]);
};
