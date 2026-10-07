import { useMemo } from 'react';
import type { THistoryEntry, THistoryQuestion } from '../History.entity';
import { buildHistory } from '../lib/buildHistory';
import { useHistoryMessages } from '../History.service';

/**
 * Resultado de `useHistoryPagination` (contrato `history-contract.md`).
 * Expone las entradas en orden cronológico ascendente y los estados de la
 * carga progresiva para que la vista decida qué renderizar (FR-013/016).
 */
export interface HistoryPagination {
  /** Entradas del histórico en orden ascendente (más antigua primero, FR-009). */
  entries: THistoryEntry[];
  /** Primera página en carga (FR-015). */
  isLoading: boolean;
  /** La carga del histórico falló (FR-015). */
  isError: boolean;
  /** Quedan páginas más antiguas por cargar (FR-013). */
  hasNextPage: boolean;
  /** Se está cargando la siguiente página. */
  isFetchingNextPage: boolean;
  /** La última página falló: la vista debe avisar que puede faltar contenido (FR-016). */
  isFetchNextPageError: boolean;
  /** Dispara la carga de la siguiente página. */
  fetchNextPage: () => void;
}

/**
 * Carga progresiva del histórico de una sesión, sin tope fijo (FR-013), y lo
 * proyecta a entradas ordenadas de más antigua a más reciente (FR-009).
 *
 * Las páginas llegan en orden `desc` (más reciente primero); se aplanan y se
 * invierten a orden ascendente antes de construir las entradas con
 * `buildHistory` (pura). Un fallo de página conserva lo ya cargado y expone
 * `isFetchNextPageError` para el aviso explícito (FR-016).
 *
 * `questions` incorpora las preguntas al usuario a la cronología ancladas a su
 * tool call (FR-033); las provee el llamador (`WorkspacePage` vía
 * `useSessionForms`), ya que los formularios los posee el dominio Inspector.
 */
export const useHistoryPagination = (
  sessionId: string | null,
  questions: THistoryQuestion[] = [],
): HistoryPagination => {
  const query = useHistoryMessages(sessionId);

  const entries = useMemo(() => {
    const pages = query.data?.pages ?? [];
    // `flatMap` crea un array nuevo, así que `reverse` no muta la caché.
    const messages = pages.flatMap((page) => page.messages).reverse();
    return buildHistory(messages, { questions });
  }, [query.data, questions]);

  return {
    entries,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
};
