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
 *
 * La fuente es `listRootSessions` (`parentID: null` + paginación por cursor,
 * FR-001/FR-002), NO la ventana cruda de 200 de `listSessions`: aquella mezclaba
 * hijas de subagente (mucho más numerosas) y dejaba raíces fuera del listado.
 */
export const useRootSessions = () => {
  const projectsQuery = useGetProjects();
  const directories = useMemo(
    () => projectDirectories(projectsQuery.data ?? []),
    [projectsQuery.data],
  );

  const rootQueries = useQueries({
    queries: directories.map((directory) => ({
      queryKey: queryKeys.sessions.roots(directory),
      queryFn: () => opencodeService.listRootSessions(directory),
      staleTime: Infinity,
    })),
  });

  const roots = useMemo(
    () =>
      rootQueries
        .flatMap((query) => query.data?.sessions ?? [])
        // Defensa en profundidad: el server ya filtra `parentID: null`
        // (`collectAllRootSessions`), pero si una respuesta mezclase hijas no
        // deben ocupar el sitio de las raíces en el listado.
        .filter((session) => session.parentID === undefined)
        .sort((a, b) => b.time.updated - a.time.updated),
    [rootQueries],
  );

  const items = useMemo<TRootSessionItem[]>(
    () =>
      roots.map((session) => ({
        // V2 expone el agente en `SessionInfo.agent`; antes había que descargar
        // el contexto de cada sesión raíz solo para deducirlo del primer mensaje.
        session,
        agentName: session.agent ?? null,
      })),
    [roots],
  );

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

  // `truncated` agregado (data-model §7): basta con que un proyecto haya
  // agotado el techo de páginas para que el aviso deba verse en el listado.
  const truncated = useMemo(
    () => rootQueries.some((query) => query.data?.truncated === true),
    [rootQueries],
  );

  const isLoading =
    projectsQuery.isLoading ||
    (rootQueries.length > 0 && rootQueries.some((q) => q.isLoading));
  const isError = projectsQuery.isError || rootQueries.some((q) => q.isError);
  const error =
    projectsQuery.error ??
    ((rootQueries.find((q) => q.error)?.error as Error | undefined) ?? null);

  return {
    items,
    groups,
    truncated,
    isLoading,
    isError,
    error,
  };
};
