import { Container, Metric } from '@app/Application/Components';
import { SectionHeading } from '@app/Application/Components/Molecules';
import {
  formatCost,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import type {
  TEfficiencyReference,
  TEfficiencyTotals,
} from '../Efficiency.entity';
import { NEUTRAL_COPY } from '../lib/labels';

export interface EfficiencyTotalsProps {
  totals: TEfficiencyTotals;
  /** Resumen de la cabecera; solo se usa para contrastar, nunca para puntuar. */
  reference?: TEfficiencyReference | null;
}

const toFiniteOrNull = (value: number | null | undefined): number | null =>
  value !== null && value !== undefined && Number.isFinite(value)
    ? value
    : null;

const formatted = (
  value: number | null | undefined,
  format: (input: number) => string,
): string | null => {
  const number = toFiniteOrNull(value);
  return number === null ? null : format(number);
};

const count = (value: number | null | undefined): string | null => {
  const number = toFiniteOrNull(value);
  return number === null ? null : String(number);
};

const referenceText = (
  value: number | null | undefined,
  format: (input: number) => string,
): string => {
  const result = formatted(value, format);
  return result ?? NEUTRAL_COPY.unavailable;
};

const differs = (
  referenceValue: number | null | undefined,
  totalValue: number | null | undefined,
): boolean =>
  referenceValue !== null &&
  referenceValue !== undefined &&
  referenceValue !== totalValue;

/**
 * Contraste opcional con el resumen ya calculado por la cabecera (R8). Solo se
 * muestra cuando algún valor difiere: el panel deriva los totales de los
 * mensajes y no incluye compactación, mientras que la cabecera puede incluirla.
 * No recalcula ni monta `SessionSummaryBar`/`MetricsSection`.
 */
const differsFromReference = (
  totals: TEfficiencyTotals,
  reference: TEfficiencyReference | null | undefined,
): boolean => {
  if (!reference) return false;
  if (differs(reference.cost, totals.cost)) return true;
  if (!reference.tokens) return false;

  return (
    differs(reference.tokens.input, totals.tokensIn) ||
    differs(reference.tokens.output, totals.tokensOut) ||
    differs(reference.tokens.cacheRead, totals.cacheRead) ||
    differs(reference.tokens.cacheWrite, totals.cacheWrite)
  );
};

/**
 * Totales del análisis (FR-017/FR-045; contrato overlay §5.6).
 *
 * Coste, tokens de entrada/salida, caché, ventana de contexto, compactaciones,
 * reintentos, errores, llamadas y latencia p95. Un dato ausente se pinta con
 * `UnavailableValue` (“no disponible”), nunca como 0 ni 100. La latencia y el
 * coste son contexto: no participan en la nota.
 *
 * Presentación pura: recibe los totales ya derivados por el motor y, si existe,
 * una referencia estructural de la cabecera para explicar la diferencia por
 * compactación.
 */
export const EfficiencyTotals = ({
  totals,
  reference,
}: EfficiencyTotalsProps) => {
  const showReference = differsFromReference(totals, reference);

  return (
    <Container space="small">
      <SectionHeading>Totales</SectionHeading>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Metric label="Coste" value={formatted(totals.cost, formatCost)} />
        <Metric
          label="Tokens in"
          value={formatted(totals.tokensIn, formatTokens)}
        />
        <Metric
          label="Tokens out"
          value={formatted(totals.tokensOut, formatTokens)}
        />
        <Metric
          label="Caché lectura"
          value={formatted(totals.cacheRead, formatTokens)}
        />
        <Metric
          label="Caché escritura"
          value={formatted(totals.cacheWrite, formatTokens)}
        />
        <Metric
          label="Ventana de contexto"
          value={formatted(totals.windowTokens, formatTokens)}
          hint="raíz"
        />
        <Metric label="Compactaciones" value={count(totals.compactions)} />
        <Metric label="Reintentos" value={count(totals.retries)} />
        <Metric
          label="Errores de herramientas"
          value={count(totals.toolErrors)}
        />
        <Metric
          label="Llamadas a herramientas"
          value={count(totals.toolCalls)}
        />
        <Metric
          label="Latencia p95"
          value={formatted(totals.latencyP95Ms, formatDuration)}
          hint="herramientas"
        />
        <Metric
          label="Llamadas >60 s"
          value={count(totals.slowToolCalls)}
          hint="contexto"
        />
      </div>

      {showReference && reference ? (
        <Container
          space="small"
          className="rounded-md border border-border p-2 text-xs text-muted-foreground"
        >
          <p>La cabecera incluye compactación; el panel no.</p>
          <p>
            Cabecera: coste {referenceText(reference.cost, formatCost)} ·
            tokens in {referenceText(reference.tokens?.input, formatTokens)} ·
            tokens out {referenceText(reference.tokens?.output, formatTokens)} ·
            caché lectura{' '}
            {referenceText(reference.tokens?.cacheRead, formatTokens)} · caché
            escritura{' '}
            {referenceText(reference.tokens?.cacheWrite, formatTokens)}.
          </p>
        </Container>
      ) : null}
    </Container>
  );
};
