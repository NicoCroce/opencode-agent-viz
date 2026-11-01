/**
 * Hook de datos del panel de eficiencia (data-model §3, research R2/R9).
 *
 * Es un **observador de caché**, no un fetch: `useQueries` se suscribe a
 * `queryKeys.sessions.messages(id)` con `queryFn: skipToken` y
 * `staleTime: Infinity`, de modo que solo refleja lo que el enriquecimiento del
 * grafo ya cargó. No importa el SDK ni crea claves nuevas.
 *
 * - `enabled: false` no monta observadores (el panel está cerrado).
 * - Raíz sin caché: `isLoading` mientras `rootReady` es falso y `no_data` (raíz
 *   pasada como `[]`) cuando ya está lista.
 * - Subárbol sin caché: `isPartial` + `missingSessionIds`; nunca se inventan
 *   mensajes vacíos.
 * - `graphError` sin informe ⇒ `isError`; con informe previo, se conserva.
 *
 * Las referencias de cada array de mensajes se estabilizan para que
 * `analyzeSession` no se recalcule en cada render; `now` es el `openedAt` fijo
 * del panel, no un reloj que tickea.
 */
import { skipToken, useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import type {
  TEfficiencyReport,
  TSessionEfficiencyResult,
  TUseSessionEfficiencyParams,
} from '../Efficiency.entity';
import { analyzeSession } from '../lib/analyzeSession';

interface TStableMessages {
  /** Ids (ordenados) a los que corresponden las referencias. */
  idsKey: string;
  values: (TSessionMessage[] | undefined)[];
}

const NO_RESULT: TSessionEfficiencyResult = {
  report: null,
  isLoading: false,
  isError: false,
  isPartial: false,
  missingSessionIds: [],
};

export const useSessionEfficiency = ({
  rootSessionId,
  sessions,
  rootReady,
  truncated,
  graphError,
  now,
  enabled,
}: TUseSessionEfficiencyParams): TSessionEfficiencyResult => {
  // Firma estable de las sesiones: solo cambia si cambia el conjunto o el
  // estado/padre de alguna. La instantánea conserva la referencia anterior
  // mientras la firma no cambie, para no invalidar los memos por un objeto
  // nuevo con el mismo contenido (R9).
  const sessionsKey = Object.keys(sessions)
    .sort()
    .map((id) => {
      const meta = sessions[id];
      return `${id}\u0001${meta?.parentID ?? ''}\u0001${meta?.status ?? ''}`;
    })
    .join('\u0000');

  const [stableSessions, setStableSessions] = useState(sessions);
  const [stableSessionsKey, setStableSessionsKey] = useState(sessionsKey);
  const sessionsChanged = stableSessionsKey !== sessionsKey;
  if (sessionsChanged) {
    setStableSessionsKey(sessionsKey);
    setStableSessions(sessions);
  }
  const currentSessions = sessionsChanged ? sessions : stableSessions;

  const sessionIds = useMemo(
    () => Object.keys(currentSessions).sort(),
    [currentSessions],
  );

  const observedIds = enabled && rootSessionId !== null ? sessionIds : [];
  const queries = useQueries({
    queries: observedIds.map((id) => ({
      queryKey: queryKeys.sessions.messages(id),
      queryFn: skipToken,
      staleTime: Infinity,
    })),
  });

  const observedKey = observedIds.join('\u0000');
  const values = queries.map(
    (query) => query.data as TSessionMessage[] | undefined,
  );

  // `useQueries` devuelve un array nuevo por render: se reutiliza el anterior
  // mientras no cambie ninguna referencia de mensajes (patrón R9).
  const [stable, setStable] = useState<TStableMessages>({
    idsKey: '',
    values: [],
  });
  const changed =
    stable.idsKey !== observedKey ||
    stable.values.length !== values.length ||
    values.some((value, index) => value !== stable.values[index]);
  if (changed) setStable({ idsKey: observedKey, values });
  const stableValues = changed ? values : stable.values;

  const rootIndex = sessionIds.indexOf(rootSessionId ?? '');
  const hasRootData =
    rootIndex !== -1 && stableValues[rootIndex] !== undefined;

  const report = useMemo<TEfficiencyReport | null>(() => {
    if (!enabled || rootSessionId === null) return null;

    const messagesBySession: Record<string, TSessionMessage[]> = {};
    sessionIds.forEach((id, index) => {
      const messages = stableValues[index];
      if (messages !== undefined) messagesBySession[id] = messages;
    });

    if (messagesBySession[rootSessionId] === undefined) {
      // Sin caché de la raíz todavía: carga; con el grafo listo, una raíz vacía
      // es `no_data` (nunca se sustituye una ausencia por datos inventados).
      if (!rootReady) return null;
      messagesBySession[rootSessionId] = [];
    }

    return analyzeSession({
      rootSessionId,
      messagesBySession,
      sessions: currentSessions,
      truncated,
      now,
    });
  }, [
    enabled,
    rootSessionId,
    rootReady,
    sessionIds,
    stableValues,
    currentSessions,
    truncated,
    now,
  ]);

  const missingSessionIds = useMemo(() => {
    if (!enabled || rootSessionId === null) return [];
    return sessionIds.filter(
      (id, index) => id !== rootSessionId && stableValues[index] === undefined,
    );
  }, [enabled, rootSessionId, sessionIds, stableValues]);

  if (!enabled || rootSessionId === null) return NO_RESULT;

  const isLoading =
    report === null &&
    !hasRootData &&
    rootReady === false &&
    graphError !== true;
  const isError = report === null && graphError === true;

  return {
    report,
    isLoading,
    isError,
    isPartial: missingSessionIds.length > 0 || truncated === true,
    missingSessionIds,
  };
};
