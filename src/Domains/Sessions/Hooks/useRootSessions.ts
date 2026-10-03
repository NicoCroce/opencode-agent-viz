import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import { projectDirectories, useGetProjects } from '../../Projects';
import type { TSession } from '../Session.entity';

export interface TRootSessionItem {
  session: TSession;
  agentName: string | null;
}

export interface TSessionGroup {
  directory: string;
  items: TRootSessionItem[];
}

/**
 * Sesiones raíz de TODOS los proyectos que OpenCode conoce, descubiertos
 * automáticamente vía /project. Cada proyecto se consulta con su `directory`
 * porque el endpoint /session está scopeado por carpeta.
 */
export const useRootSessions = () => {
  const projectsQuery = useGetProjects();
  const directories = useMemo(
    () => projectDirectories(projectsQuery.data ?? []),
    [projectsQuery.data],
  );

  const sessionQueries = useQueries({
    queries: directories.map((directory) => ({
      queryKey: queryKeys.sessions.list(directory),
      queryFn: () => opencodeService.listSessions(directory),
      staleTime: Infinity,
    })),
  });

  const sessions = useMemo(
    () => sessionQueries.flatMap((query) => query.data ?? []),
    [sessionQueries],
  );

  const roots = useMemo(
    () =>
      sessions
        .filter((s) => s.parentID === undefined)
        .sort((a, b) => b.time.updated - a.time.updated),
    [sessions],
  );

  // V2 expone el agente en `SessionInfo.agent`; antes había que descargar el
  // contexto de cada sesión raíz solo para deducirlo del primer mensaje.
  const items: TRootSessionItem[] = roots.map((session) => ({
    session,
    agentName: session.agent ?? null,
  }));

  const groups = useMemo<TSessionGroup[]>(() => {
    const map = new Map<string, TRootSessionItem[]>();
    for (const item of items) {
      const key = item.session.location.directory;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([directory, groupItems]) => ({
      directory,
      items: groupItems,
    }));
  }, [items]);

  const isLoading =
    projectsQuery.isLoading ||
    (sessionQueries.length > 0 && sessionQueries.some((q) => q.isLoading));
  const isError = projectsQuery.isError || sessionQueries.some((q) => q.isError);
  const error =
    projectsQuery.error ??
    ((sessionQueries.find((q) => q.error)?.error as Error | undefined) ?? null);

  return {
    items,
    groups,
    isLoading,
    isError,
    error,
  };
};
