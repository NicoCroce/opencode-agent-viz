import type { ReactNode } from 'react';
import type { THistoryEntry } from '@app/Domains/History/History.entity';
import {
  HISTORY_KIND_LABEL,
  HISTORY_KIND_STRIPE,
} from './HistoryEntry.constants';
import { HistoryEntryBody } from './HistoryEntryBody';

interface HistoryEntryProps {
  /** Entrada cronológica del histórico (`buildHistory`). */
  entry: THistoryEntry;
  /**
   * Cuando es `false`, las entradas de razonamiento no se renderizan (FR-002).
   * La visibilidad la posee el llamador (`useReasoningVisibility`).
   */
  showReasoning?: boolean;
  /**
   * Sesión a la que pertenece la entrada. Se pasa al render del contexto de
   * compactación inyectado por el llamador (FR-035); sin ella la compactación
   * se muestra sin contexto.
   */
  sessionId?: string | null;
  /**
   * Render del contexto resultante de una compactación (FR-035). Lo inyecta el
   * llamador del dominio dueño (que pide los datos con `useSessionContext`),
   * de modo que este componente compartido no depende de ningún service de
   * dominio (Constitución II). Sin él, la compactación se muestra sin contexto.
   */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/**
 * Renderiza una entrada del histórico con una franja/etiqueta plana de tipo
 * (FR-003). El texto del agente se muestra con `RichText` y el razonamiento
 * atenuado; una respuesta no consolidada se indica como "en curso" sin
 * presentar texto parcial como completo (FR-006).
 *
 * Composición raíz: cabecera (`KIND_LABEL`/franja) + despacho a
 * `HistoryEntryBody`, que resuelve el cuerpo por `kind`.
 */
export const HistoryEntry = ({
  entry,
  showReasoning = true,
  sessionId = null,
  renderCompactionContext,
}: HistoryEntryProps) => {
  if (entry.kind === 'reasoning' && !showReasoning) {
    return null;
  }

  return (
    <article
      className={`flex flex-col gap-1 border-l-2 pl-3 ${HISTORY_KIND_STRIPE[entry.kind]}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {HISTORY_KIND_LABEL[entry.kind]}
      </span>
      <HistoryEntryBody
        entry={entry}
        sessionId={sessionId}
        renderCompactionContext={renderCompactionContext}
      />
    </article>
  );
};
