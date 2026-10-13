import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { DetailRow, SectionFrame } from '@app/Application/Components/Molecules';
import {
  formatPercent,
  formatTokens,
} from '@app/Application/Helpers';
import { formatClock } from '@app/Application/Helpers/format/clock';
import type {
  TCompactionEffect,
  TContextCompactionReason,
  TNodeContextMetrics,
  TTokenUsage,
} from '@app/Domains/Graph/Graph.entity';
import { ContextCompositionBar } from './ContextCompositionBar';
import { ContextGrowth } from './ContextGrowth';
import { ContextSectionSkeleton } from './ContextSectionSkeleton';

/** Etiqueta legible del motivo de una compactación (FR-016). */
const COMPACTION_REASON_LABEL: Record<TContextCompactionReason, string> = {
  auto: 'Automática',
  manual: 'Manual',
};

interface ContextSectionProps {
  /** Métricas de contexto del nodo; `null`/ausente hasta el enriquecimiento. */
  context: TNodeContextMetrics | null;
  /** Tokens del nodo: salida y razonamiento para su relación (FR-016). */
  tokens?: TTokenUsage | null;
  /** Efecto de la última compactación sobre la ventana (FR-016). */
  compactionEffect?: TCompactionEffect | null;
  isError?: boolean;
  isLoading?: boolean;
  /**
   * Secciones adicionales que otras historias montan dentro del bloque de
   * contexto (paralelismo, aporte al padre). Se añaden tras la
   * composición, la ventana, la evolución, la salida y las compactaciones.
   */
  children?: ReactNode;
}

/** Hay datos si el desglose tiene contenido o hay una ventana medible. */
const hasContextData = (context: TNodeContextMetrics | null): boolean =>
  context !== null &&
  (context.breakdown.buckets.length > 0 || context.window.windowTokens !== null);

/** Porcentaje del razonamiento sobre la salida total; `null` sin denominador. */
const reasoningShare = (tokens: TTokenUsage | null | undefined): number | null => {
  const output = tokens?.output ?? null;
  const reasoning = tokens?.reasoning ?? null;
  if (output === null || reasoning === null) return null;
  const total = output + reasoning;
  return total > 0 ? (reasoning / total) * 100 : null;
};

/**
 * Bloque de contexto del panel de detalle (FR-015..FR-017;
 * `contracts/context-panel-contract.md` §2/§6). Reúne la composición, la
 * ventana/caché (con la tasa de acierto y el coste por 1k), la evolución del
 * contexto, la salida con su relación de razonamiento y las compactaciones, con
 * los cuatro estados de pantalla delegados a `SectionFrame`. Otras historias
 * añaden apartados vía `children`.
 */
export const ContextSection = ({
  context,
  tokens = null,
  compactionEffect = null,
  isError = false,
  isLoading = false,
  children,
}: ContextSectionProps) => {
  const window = context?.window ?? null;
  const breakdown = context?.breakdown ?? null;
  const growth = context?.growth ?? [];
  const compactions = context?.compactions ?? [];
  const output = tokens?.output ?? null;
  const reasoning = tokens?.reasoning ?? null;
  const share = reasoningShare(tokens);
  const lastCompaction = compactions[compactions.length - 1] ?? null;
  const effectLabel =
    compactionEffect &&
    (compactionEffect.before !== null || compactionEffect.after !== null)
      ? `${formatTokens(compactionEffect.before)} → ${formatTokens(
          compactionEffect.after,
        )}`
      : null;

  return (
    <SectionFrame
      title="Contexto"
      isError={isError}
      isLoading={isLoading}
      isEmpty={!hasContextData(context)}
      emptyLabel="Sin datos de contexto"
      loading={<ContextSectionSkeleton />}
    >
      <Container space="small">
        {context?.provisional ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            provisional
          </span>
        ) : null}

        {breakdown && breakdown.buckets.length > 0 ? (
          <ContextCompositionBar
            buckets={breakdown.buckets}
            hasTokens={breakdown.hasTokens}
          />
        ) : null}

        <Container space="none" className="gap-0.5">
          <DetailRow
            label="Ventana de contexto"
            value={formatTokens(window?.windowTokens ?? null)}
          />
          <DetailRow
            label="Caché (lectura)"
            value={formatTokens(window?.cacheRead ?? null)}
          />
          <DetailRow
            label="Caché (escritura)"
            value={formatTokens(window?.cacheWrite ?? null)}
          />
          <DetailRow
            label="Acierto de caché"
            value={
              window?.hitRate === null || window?.hitRate === undefined
                ? null
                : formatPercent(window.hitRate * 100, 0)
            }
          />
          <DetailRow
            label="Coste por 1k tokens"
            value={
              window?.costPerKToken === null ||
              window?.costPerKToken === undefined
                ? null
                : `$${window.costPerKToken.toFixed(4)}`
            }
          />
        </Container>

        <ContextGrowth points={growth} />

        <Container space="none" className="gap-0.5">
          <DetailRow label="Salida (respuesta)" value={formatTokens(output)} />
          <DetailRow label="Razonamiento" value={formatTokens(reasoning)} />
          <DetailRow
            label="Razonamiento sobre la salida"
            value={share === null ? null : formatPercent(share, 0)}
          />
        </Container>

        <Container space="none" className="gap-0.5">
          {compactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin compactaciones</p>
          ) : (
            <>
              <DetailRow
                label="Compactaciones"
                value={compactions.length}
              />
              <DetailRow
                label="Motivo"
                value={COMPACTION_REASON_LABEL[lastCompaction.reason]}
              />
              <DetailRow label="Efecto" value={effectLabel} />
              {lastCompaction ? (
                <DetailRow
                  label="Última"
                  value={`${formatClock(lastCompaction.at)} · ${
                    lastCompaction.status
                  }`}
                />
              ) : null}
            </>
          )}
        </Container>

        {children}
      </Container>
    </SectionFrame>
  );
};
