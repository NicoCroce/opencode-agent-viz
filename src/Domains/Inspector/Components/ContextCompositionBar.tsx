import { Container } from '@app/Application/Components';
import { formatPercent, formatTokens } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type {
  TContextBucket,
  TContextCategory,
} from '@app/Domains/Graph/Graph.entity';

/** Etiquetas legibles de cada categoría del desglose (FR-004). */
export const CONTEXT_CATEGORY_LABEL: Record<TContextCategory, string> = {
  toolResult: 'Resultados de herramientas',
  toolInput: 'Entradas de herramientas',
  reasoning: 'Razonamiento',
  assistantText: 'Texto del asistente',
  userText: 'Texto del usuario',
};

/**
 * Color por categoría, reutilizando tokens del tema. El color **no** es la
 * única señal: la leyenda aporta etiqueta y valor textual (a11y,
 * `contracts/context-panel-contract.md` §7).
 */
const CATEGORY_COLOR: Record<TContextCategory, string> = {
  // Escala cyan por luminosidad (chart-1..4) + gris: las categorías se
  // distinguen por claridad, no solo por tono, y no reutilizan LEDs de estado.
  toolResult: 'bg-chart-1',
  toolInput: 'bg-chart-3',
  reasoning: 'bg-chart-2',
  assistantText: 'bg-chart-4',
  userText: 'bg-status-idle',
};

interface ContextCompositionBarProps {
  /** Buckets ordenados por peso descendente (FR-004). */
  buckets: TContextBucket[];
  /** Si hay tokens medibles, la leyenda muestra tokens; si no, caracteres. */
  hasTokens: boolean;
}

/**
 * Barra apilada de la composición del contexto con leyenda (FR-001..FR-004;
 * `contracts/context-panel-contract.md` §2/§7): barra segmentada de 8px con 2px
 * entre tramos y leyenda con muestras cuadradas de 8px. Presentación pura:
 * recibe los buckets ya derivados. Cada categoría muestra su porcentaje y su valor
 * absoluto (tokens o caracteres), de modo que la lectura no depende del color.
 */
export const ContextCompositionBar = ({
  buckets,
  hasTokens,
}: ContextCompositionBarProps) => {
  const summary = buckets
    .map(
      (bucket) =>
        `${CONTEXT_CATEGORY_LABEL[bucket.category]} ${formatPercent(bucket.pct, 0)}`,
    )
    .join(', ');

  return (
    <Container space="small">
      <Container
        row
        space="none"
        role="img"
        aria-label={`Composición del contexto: ${summary}`}
        className="h-2 w-full gap-0.5! overflow-hidden rounded bg-secondary"
      >
        {buckets.map((bucket) => (
          <span
            key={bucket.category}
            className={cn('h-full', CATEGORY_COLOR[bucket.category])}
            style={{ width: `${bucket.pct}%` }}
          />
        ))}
      </Container>

      <Container space="none" className="gap-1!">
        {buckets.map((bucket) => (
          <Container
            key={bucket.category}
            row
            align="center"
            justify="between"
            space="small"
            className="min-w-0 gap-2 text-xs"
          >
            <Container row align="center" space="small" className="min-w-0 gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'size-2 shrink-0 rounded-[2px]',
                  CATEGORY_COLOR[bucket.category],
                )}
              />
              <span className="min-w-0 truncate text-muted-foreground">
                {CONTEXT_CATEGORY_LABEL[bucket.category]}
              </span>
            </Container>
            <Container
              row
              align="center"
              space="small"
              className="shrink-0 gap-2 font-mono tabular-nums"
            >
              <span className="text-foreground">{formatPercent(bucket.pct, 0)}</span>
              <span className="text-muted-foreground">
                {hasTokens && bucket.tokens !== null
                  ? `${formatTokens(bucket.tokens)} tok`
                  : `${bucket.chars} car`}
              </span>
            </Container>
          </Container>
        ))}
      </Container>
    </Container>
  );
};
