import { Container } from '@app/Application/Components';
import { formatTokens } from '@app/Application/Helpers';
import { prefersReducedMotion } from '@app/Application/Helpers/prefersReducedMotion';
import { cn } from '@app/Application/lib/utils';
import type {
  TContextCompaction,
  TContextGrowthPoint,
} from '@app/Domains/Graph/Graph.entity';
import {
  buildGrowthChart,
  GROWTH_VIEW_HEIGHT,
  GROWTH_VIEW_WIDTH,
} from '../lib/contextGrowthChart';

interface ContextGrowthProps {
  /** Serie temporal del contexto, ordenada por `startedAt` (FR-016). */
  points: TContextGrowthPoint[];
  /** Compactaciones de la sesión, en orden temporal; se marcan sobre la línea. */
  compactions?: TContextCompaction[];
  /** Límite de contexto del modelo; `null` si el catálogo no lo trae. */
  limitTokens?: number | null;
}

/**
 * Gráfico de la evolución del contexto por paso (FR-016;
 * `contracts/context-panel-contract.md` §2). Presentación pura. El eje Y empieza
 * en 0 y llega al límite del modelo si se conoce (línea punteada); cada
 * compactación es una muesca vertical. El SVG es **una imagen atómica**
 * (`role="img"`) cuya etiqueta resume la serie; el resumen se repite como texto
 * visible, así la información no depende del dibujo. La aparición se anima con
 * un recorte que se abre de izquierda a derecha y se omite con
 * `prefers-reduced-motion`.
 */
export const ContextGrowth = ({
  points,
  compactions = [],
  limitTokens = null,
}: ContextGrowthProps) => {
  if (points.length === 0) return null;

  const first = points[0].windowTokens;
  const last = points[points.length - 1].windowTokens;
  const stepWord = points.length === 1 ? 'paso' : 'pasos';
  const compactionText =
    compactions.length === 0
      ? null
      : `${compactions.length} ${
          compactions.length === 1 ? 'compactación' : 'compactaciones'
        }`;
  const limitText =
    limitTokens === null ? null : `límite ${formatTokens(limitTokens)}`;

  const summary = [
    `Evolución del contexto: ${points.length} ${stepWord}, de ${formatTokens(
      first,
    )} a ${formatTokens(last)} tokens`,
    compactionText,
    limitText,
  ]
    .filter(Boolean)
    .join(', ');
  const caption = [
    `${formatTokens(first)} → ${formatTokens(last)} tok`,
    `${points.length} ${stepWord}`,
    compactionText,
    limitText,
  ]
    .filter(Boolean)
    .join(' · ');

  if (points.length === 1) {
    return (
      <Container space="small" data-testid="context-growth">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Evolución del contexto
        </span>
        <span
          role="img"
          aria-label={summary}
          className="font-mono text-[11px] tabular-nums text-muted-foreground"
        >
          {caption}
        </span>
      </Container>
    );
  }

  const chart = buildGrowthChart(points, compactions, limitTokens);
  const reduceMotion = prefersReducedMotion();

  return (
    <Container space="small" data-testid="context-growth">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Evolución del contexto
      </span>
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${GROWTH_VIEW_WIDTH} ${GROWTH_VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className={cn(
          'h-12 w-full text-primary',
          !reduceMotion && 'growth-reveal',
        )}
      >
        {chart.limitY !== null ? (
          <line
            data-testid="context-growth-limit"
            x1={0}
            x2={GROWTH_VIEW_WIDTH}
            y1={chart.limitY}
            y2={chart.limitY}
            className="text-muted-foreground"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {chart.marks.map((mark) => (
          <line
            key={mark.id}
            data-testid="context-growth-compaction"
            x1={mark.x}
            x2={mark.x}
            y1={0}
            y2={GROWTH_VIEW_HEIGHT}
            className={cn(
              mark.failed ? 'text-status-error' : 'text-status-waiting',
            )}
            stroke="currentColor"
            strokeOpacity={0.6}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={chart.line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {caption}
      </span>
    </Container>
  );
};
