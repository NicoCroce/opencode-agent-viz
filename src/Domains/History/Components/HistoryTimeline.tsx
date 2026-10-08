import { useRef, type CSSProperties, type ReactNode } from 'react';
import { EmptyState, HistoryEntry } from '@app/Application/Components';
import type { THistoryEntry } from '../History.entity';
import { useHistorySentinel } from '../Hooks/useHistorySentinel';
import { HistoryLoadError } from './HistoryLoadError';

interface HistoryTimelineProps {
  /** Entradas del histórico en orden cronológico ascendente (`buildHistory`). */
  entries: THistoryEntry[];
  /** Visibilidad del razonamiento (FR-002); la posee el llamador. */
  showReasoning: boolean;
  /** Quedan páginas más antiguas por cargar (FR-013). */
  hasNextPage: boolean;
  /** Se está cargando la página anterior. */
  isFetchingNextPage: boolean;
  /** La página anterior falló: hay que avisar de que puede faltar contenido (FR-016). */
  isFetchNextPageError: boolean;
  /** Dispara la carga de la página anterior (más antigua). */
  fetchNextPage: () => void;
  /**
   * Sesión a la que pertenece el histórico. Se reenvía a `HistoryEntry` y a su
   * render del contexto de compactación (FR-035).
   */
  sessionId?: string | null;
  /**
   * Render del contexto de compactación (FR-035), inyectado por el llamador
   * (que pide los datos con el hook del dominio dueño). Se reenvía tal cual a
   * `HistoryEntry`; sin él la compactación se muestra sin contexto.
   */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/**
 * Tamaño intrínseco reservado por fila para que `content-visibility: auto`
 * pueda saltarse el render de las entradas fuera de pantalla sin provocar
 * saltos de scroll (SC-011).
 */
const ROW_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 4rem',
};

/**
 * Timeline del histórico completo de una sesión (FR-009/013/016).
 *
 * Renderiza las entradas en orden con `HistoryEntry` (que a su vez delega las
 * herramientas en `ToolCallEntry`). El centinela superior observado con
 * `IntersectionObserver` dispara `fetchNextPage` cuando el usuario llega al
 * principio, ampliando la actividad sin tope fijo (FR-013). Cada fila usa
 * `content-visibility: auto` con `contain-intrinsic-size` para mantener la
 * interacción fluida con históricos largos (SC-011). Un fallo de página no se
 * presenta como el final de la sesión: se muestra un aviso explícito (FR-016).
 */
export const HistoryTimeline = ({
  entries,
  showReasoning,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  sessionId = null,
  renderCompactionContext,
}: HistoryTimelineProps) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useHistorySentinel({
    sentinelRef,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  });

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Sin actividad registrada"
        description="Esta sesión no tiene actividad que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hasNextPage || isFetchNextPageError ? (
        <div
          ref={sentinelRef}
          data-testid="history-sentinel"
          className="flex min-h-[1px] flex-col items-center gap-1 py-1"
        >
          {isFetchingNextPage ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              Cargando actividad anterior…
            </span>
          ) : null}
        </div>
      ) : null}

      {isFetchNextPageError ? <HistoryLoadError /> : null}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <div key={entry.id} style={ROW_STYLE}>
            <HistoryEntry
              entry={entry}
              showReasoning={showReasoning}
              sessionId={sessionId}
              renderCompactionContext={renderCompactionContext}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
