import { Container } from '@app/Application/Components';
import {
  formatCost,
  formatDuration,
  formatTimeRange,
  formatTokens,
  sumNullable,
} from '@app/Application/Helpers';
import { formatClock } from '@app/Application/Helpers/format/clock';
import { UNAVAILABLE_LABEL } from '@app/Application/Helpers/format/constants';
import { totalTokens } from '@app/Application/Helpers/totalTokens';
import type {
  TContextWindow,
  TCurrentTool,
  TGraphNodeData,
  TNodeMetrics,
  TNodeStatus,
} from '../Graph.entity';

interface AgentNodeFooterProps {
  metrics: TNodeMetrics;
  /** Ventana de contexto del nodo (FR-011); `null` hasta el enriquecimiento. */
  contextWindow: TContextWindow | null;
  /**
   * Condición compartida con `cardHeight` (`lib/cardHeight.ts`): decide si se
   * pinta (y si el alto reserva) la fila de flujo in/out (FR-011). El pie no la
   * recalcula; llega ya resuelta desde `AgentNode`.
   */
  hasContextFlow: boolean;
  isRunning: boolean;
  status: TNodeStatus;
  currentTool: TCurrentTool | null;
  retry: TGraphNodeData['retry'];
  interruptReason: string | null;
}

/**
 * Pie del card, en dos registros:
 * - **Vitals**: consumo (tokens · costo · duración), la carga analítica.
 * - **Contexto**: rango horario compacto (`HH:mm → HH:mm`) y, cuando aplica, la
 *   herramienta en curso (FR-018) en la misma línea.
 *
 * La línea `contexto: X ↓ · Y ↑` (FR-011) muestra el flujo de entrada (ventana
 * del nodo) y salida (`output + reasoning`) sin inventar valores: cada extremo
 * ausente cae a "no disponible". El reintento (FR-018) y la interrupción
 * (FR-019) conservan su propia línea en color de estado.
 */
export const AgentNodeFooter = ({
  metrics,
  contextWindow,
  hasContextFlow,
  isRunning,
  status,
  currentTool,
  retry,
  interruptReason,
}: AgentNodeFooterProps) => {
  const timeRange = formatTimeRange({
    startedAt: metrics.startedAt,
    endedAt: metrics.endedAt,
    isRunning,
  });
  const tokens = totalTokens(metrics.tokens);

  // Flujo de contexto in/out (FR-011): entrada = ventana; salida = output +
  // reasoning. `null` en un extremo cuando no hay dato (nunca `0` inventado).
  const inputTokens = contextWindow?.windowTokens ?? null;
  const outputTokens = sumNullable([
    metrics.tokens?.output ?? null,
    metrics.tokens?.reasoning ?? null,
  ]);

  // Reintento (FR-018): número de intento y, si el servidor lo reporta, el
  // momento del próximo. `next` ausente → "no disponible" (edge case).
  const retryLabel = retry
    ? `Intento ${retry.attempt} · próximo ${
        retry.next !== null ? formatClock(retry.next) : UNAVAILABLE_LABEL
      }`
    : null;

  // Motivo de la interrupción (FR-019): distingue una interrupción de un fallo
  // propio. Motivo ausente → "no disponible".
  const interruptLabel =
    status === 'interrupted'
      ? `Motivo: ${interruptReason ?? UNAVAILABLE_LABEL}`
      : null;

  return (
    <Container
      space="none"
      className="mt-auto min-w-0 gap-1 border-t border-border pt-1.5"
    >
      <Container
        row
        align="center"
        space="none"
        className="min-w-0 flex-wrap gap-x-1.5 font-mono text-[11px] tabular-nums text-foreground/70"
      >
        <span>
          {tokens === null ? formatTokens(null) : `${formatTokens(tokens)} tok`}
        </span>
        <span aria-hidden>·</span>
        <span>{formatCost(metrics.cost)}</span>
        <span aria-hidden>·</span>
        <span>{formatDuration(metrics.durationMs)}</span>
      </Container>

      <Container
        row
        align="center"
        space="none"
        className="min-w-0 gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground"
      >
        <span className="min-w-0 truncate">{timeRange}</span>
        {currentTool ? (
          <>
            <span aria-hidden>·</span>
            <span
              className="min-w-0 truncate text-foreground/80"
              title={currentTool.name}
            >
              {currentTool.name}
            </span>
          </>
        ) : null}
      </Container>

      {hasContextFlow ? (
        <span
          className="min-w-0 truncate font-mono text-[11px] tabular-nums text-muted-foreground"
          title="Flujo de contexto: entrada ↓ y salida ↑"
        >
          {`contexto: ${formatTokens(inputTokens)} ↓ · ${formatTokens(
            outputTokens,
          )} ↑`}
        </span>
      ) : null}

      {retryLabel ? (
        <span
          className="min-w-0 truncate font-mono text-[11px] tabular-nums text-status-running"
          title={retryLabel}
        >
          {retryLabel}
        </span>
      ) : null}
      {interruptLabel ? (
        <span
          className="min-w-0 truncate font-mono text-[11px] text-status-error"
          title={interruptLabel}
        >
          {interruptLabel}
        </span>
      ) : null}
    </Container>
  );
};
