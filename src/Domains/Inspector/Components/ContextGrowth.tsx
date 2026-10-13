import { Container } from '@app/Application/Components';
import { formatTokens } from '@app/Application/Helpers';
import { prefersReducedMotion } from '@app/Application/Helpers/prefersReducedMotion';
import { cn } from '@app/Application/lib/utils';
import type { TContextGrowthPoint } from '@app/Domains/Graph/Graph.entity';

/** Sistema de coordenadas del sparkline (se escala con `preserveAspectRatio`). */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 24;

interface ContextGrowthProps {
  /** Serie temporal del contexto, ordenada por `startedAt` (FR-016). */
  points: TContextGrowthPoint[];
}

/**
 * Sparkline de la evolución del contexto por paso (FR-016;
 * `contracts/context-panel-contract.md` §2). Presentación pura: recibe la serie
 * ya derivada. El SVG es **una imagen atómica** (`role="img"`) con una etiqueta
 * que resume la tendencia; el valor inicial/final y el número de pasos se
 * repiten como texto visible, de modo que la información no depende del trazo.
 * El dibujo animado se omite con `prefers-reduced-motion` (a11y): la línea queda
 * completa y estática.
 */
export const ContextGrowth = ({ points }: ContextGrowthProps) => {
  if (points.length === 0) return null;

  const values = points.map((point) => point.windowTokens);
  const first = values[0];
  const last = values[values.length - 1];
  const stepWord = points.length === 1 ? 'paso' : 'pasos';
  const summary = `Evolución del contexto: ${points.length} ${stepWord}, de ${formatTokens(
    first,
  )} a ${formatTokens(last)} tokens`;

  const caption = `${formatTokens(first)} → ${formatTokens(last)} tok · ${
    points.length
  } ${stepWord}`;

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

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = VIEW_WIDTH / (points.length - 1);
  const coordinates = points
    .map((point, index) => {
      const x = index * stepX;
      const y = VIEW_HEIGHT - ((point.windowTokens - min) / span) * VIEW_HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const reduceMotion = prefersReducedMotion();

  return (
    <Container space="small" data-testid="context-growth">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Evolución del contexto
      </span>
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-6 w-full text-primary"
      >
        <polyline
          points={coordinates}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          className={cn(!reduceMotion && 'growth-draw')}
        />
      </svg>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {caption}
      </span>
    </Container>
  );
};
