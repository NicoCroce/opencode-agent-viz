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
  toolResult: 'bg-primary',
  toolInput: 'bg-status-waiting',
  reasoning: 'bg-status-running',
  assistantText: 'bg-status-done',
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
 * `contracts/context-panel-contract.md` §2/§7). Presentación pura: recibe los
 * buckets ya derivados. Cada categoría muestra su porcentaje y su valor
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
        className="h-2 w-full overflow-hidden rounded-flat border border-border"
      >
        {buckets.map((bucket) => (
          <span
            key={bucket.category}
            className={cn('h-full', CATEGORY_COLOR[bucket.category])}
            style={{ width: `${bucket.pct}%` }}
          />
        ))}
      </Container>

      <Container space="none" className="gap-0.5">
        {buckets.map((bucket) => (
          <Container
            key={bucket.category}
            row
            align="center"
            justify="between"
            space="small"
            className="min-w-0 gap-2 text-[11px]"
          >
            <Container row align="center" space="small" className="min-w-0 gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  CATEGORY_COLOR[bucket.category],
                )}
              />
              <span className="min-w-0 truncate text-foreground/80">
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
