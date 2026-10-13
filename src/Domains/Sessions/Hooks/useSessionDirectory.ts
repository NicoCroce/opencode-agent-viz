import { useQuery } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { isSessionNotFound } from '@app/Infrastructure/Services/lib/sessionErrors';
import { queryKeys } from '../../queryKeys';
import type { TRootSessionItem } from './useRootSessions';

export interface TSessionDirectory {
  /** Directorio del proyecto de la sesión, o `null` si no se pudo resolver. */
  directory: string | null;
  /** Solo `true` mientras el respaldo (`session.get`) está en vuelo. */
  isLoading: boolean;
  /** El respaldo falló (p. ej. la sesión no existe): no se confunde con "cargando". */
  isError: boolean;
  /**
   * El respaldo falló porque el servidor dijo que la sesión no existe. Un fallo
   * de red/servidor (`isError` sin `isNotFound`) NO es "no encontrada".
   */
  isNotFound: boolean;
}

/**
 * Resuelve el `directory` de una sesión por su id (FR-003, contrato §5, R3).
 *
 * La lista de raíces ya no garantiza que la sesión abierta esté en la ventana
 * (`useRootSessions` pagina por cursor y puede truncar), así que el `directory`
 * se resuelve con la cadena **`items` → `opencodeService.getSession(id)` →
 * `null`**:
 *
 * 1. Si la sesión está en `items`, el directorio sale de ahí **sin red**.
 * 2. Si no está (o no hay id), se respalda con `session.get`, cacheado por id en
 *    `sessions.directory(id)` porque los eventos no siempre exponen el `directory`.
 *
 * El 404 no se traga en el servicio (Principio III: el SDK solo se consume desde
 * `*.service.ts`); aquí un fallo del respaldo se traduce a "no encontrada":
 * `directory: null` con `isError: true`, nunca como "aún cargando" (Principio VI).
 */
export const useSessionDirectory = (
  id: string | null,
  items: TRootSessionItem[],
): TSessionDirectory => {
  const fromItems =
    id === null
      ? null
      : (items.find((item) => item.session.id === id)?.session.location
          .directory ?? null);

  // El respaldo solo tiene sentido si hay id y la sesión no está en la lista.
  const needsFallback = id !== null && fromItems === null;

  const query = useQuery({
    queryKey: queryKeys.sessions.directory(id ?? ''),
    queryFn: () => opencodeService.getSession(id as string),
    enabled: needsFallback,
    staleTime: Infinity,
  });

  if (fromItems !== null) {
    return { directory: fromItems, isLoading: false, isError: false, isNotFound: false };
  }

  if (!needsFallback) {
    return { directory: null, isLoading: false, isError: false, isNotFound: false };
  }

  return {
    directory: query.data?.location.directory ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isNotFound: query.isError && isSessionNotFound(query.error),
  };
};
