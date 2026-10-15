import { Container } from '@app/Application/Components';
import {
  DetailRow,
  SectionFrame,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import { formatPercent, formatSpeedup } from '@app/Application/Helpers';
import { formatClock } from '@app/Application/Helpers/format/clock';
import type {
  TLatencyAnomaly,
  TLatencyReport,
} from '@app/Domains/Graph/Graph.entity';
import {
  LATENCY_PART_LABEL,
  NO_PACE_LABEL,
  THRESHOLD_HINT,
  describePace,
  formatLatency,
  summarizeLatency,
} from '../lib/latencyBreakdown';
import { LatencySampleRow } from './LatencySampleRow';

/** Rango del control de umbral, en puntos porcentuales sobre lo esperado (`latency-anomaly-contract` §5). */
const THRESHOLD_MIN_PCT = 25;
const THRESHOLD_MAX_PCT = 300;
const THRESHOLD_STEP_PCT = 25;

interface LatencySectionProps {
  /** Serie de latencia del nodo; `null`/vacía hasta el enriquecimiento (US5). */
  latency: TLatencyReport | null;
  /** Umbral vigente: fracción sobre lo esperado (1 = el doble) (FR-022). */
  threshold: number;
  /** Cambia el umbral; el hook lo acota y persiste antes de propagarlo. */
  onThresholdChange: (value: number) => void;
  isError?: boolean;
  isLoading?: boolean;
}

/**
 * Apartado **Latencia** del panel de detalle (FR-018..FR-023;
 * `contracts/context-panel-contract.md` §4). Explica en qué se fue el tiempo del
 * nodo (modelo, herramientas, subagentes, usuario), el ritmo esperado de cada
 * modelo, el umbral de lentitud y cada respuesta con su desglose. Resuelve los
 * cuatro estados de pantalla vía `SectionFrame`. Presentación pura: el umbral
 * llega por props.
 */
export const LatencySection = ({
  latency,
  threshold,
  onThresholdChange,
  isError = false,
  isLoading = false,
}: LatencySectionProps) => {
  const samples = latency?.samples ?? [];
  const paces = latency?.paces ?? [];
  const anomalies = latency?.anomalies ?? [];
  const shares = summarizeLatency(samples);
  const thresholdPct = Math.round(threshold * 100);
  const factor = formatSpeedup(1 + threshold);

  const anomalyByStep = new Map<string, TLatencyAnomaly>(
    anomalies.map((anomaly) => [anomaly.stepId, anomaly]),
  );
  // Las anomalías salen de las muestras: cada una tiene su posición y su hora.
  const stepInfo = new Map(
    samples.map((sample, index) => [
      sample.stepId,
      `#${index + 1} · ${formatClock(sample.startedAt)}`,
    ]),
  );

  return (
    <SectionFrame
      title="Latencia"
      isError={isError}
      isLoading={isLoading}
      isEmpty={samples.length === 0}
      emptyLabel="Sin respuestas medidas"
      data-testid="latency-section"
    >
      <Container space="small">
        {shares.length > 0 ? (
          <Container space="none" className="gap-0.5">
            <SectionHeading>Reparto del tiempo</SectionHeading>
            {shares.map((share) => (
              <DetailRow
                key={share.kind}
                label={LATENCY_PART_LABEL[share.kind]}
                value={`${formatLatency(share.ms)} · ${formatPercent(share.pct, 0)}`}
              />
            ))}
          </Container>
        ) : null}

        <Container space="none" className="gap-0.5">
          <SectionHeading>Ritmo esperado del modelo</SectionHeading>
          {paces.length > 0 ? (
            paces.map((pace) => (
              <DetailRow
                key={pace.model}
                label={pace.model}
                value={describePace(pace)}
              />
            ))
          ) : (
            <p className="text-[11px] text-muted-foreground">{NO_PACE_LABEL}</p>
          )}
        </Container>

        <Container space="small">
          <label
            htmlFor="anomaly-threshold"
            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            Umbral de lentitud
          </label>
          <Container row align="center" space="small">
            {/*
              `h-6` (24 px) amplía el área interactiva hasta el objetivo táctil
              manteniendo la pista nativa (aspecto visual intacto) y la
              operabilidad por teclado (SC-007).
            */}
            <input
              id="anomaly-threshold"
              type="range"
              min={THRESHOLD_MIN_PCT}
              max={THRESHOLD_MAX_PCT}
              step={THRESHOLD_STEP_PCT}
              value={thresholdPct}
              onChange={(event) =>
                onThresholdChange(Number(event.target.value) / 100)
              }
              aria-label={`Umbral de lentitud: ${factor} lo esperado`}
              aria-describedby="anomaly-threshold-hint"
              className="h-6 w-full cursor-pointer accent-primary"
            />
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
              {factor}
            </span>
          </Container>
          <p
            id="anomaly-threshold-hint"
            className="text-[10px] leading-4 text-muted-foreground"
          >
            {THRESHOLD_HINT}
          </p>
        </Container>

        <Container space="none" className="gap-1" role="list">
          <SectionHeading>Respuestas</SectionHeading>
          {samples.map((sample, index) => (
            <LatencySampleRow
              key={sample.stepId}
              sample={sample}
              position={index + 1}
              anomaly={anomalyByStep.get(sample.stepId) ?? null}
            />
          ))}
        </Container>

        {anomalies.length > 0 ? (
          <Container space="none" className="gap-0.5" role="list">
            <SectionHeading>Respuestas lentas</SectionHeading>
            {anomalies.map((anomaly) => (
              <Container
                key={anomaly.stepId}
                row
                align="center"
                justify="between"
                space="small"
                role="listitem"
                className="min-w-0 gap-2 font-mono text-[11px] tabular-nums"
              >
                <span className="min-w-0 truncate text-status-error">
                  {stepInfo.get(anomaly.stepId)}
                </span>
                <span className="shrink-0 text-foreground">
                  {`${formatSpeedup(anomaly.ratio)} · +${formatLatency(
                    anomaly.excessMs,
                  )} sobre ${formatLatency(anomaly.expectedMs)}`}
                </span>
              </Container>
            ))}
          </Container>
        ) : null}
      </Container>
    </SectionFrame>
  );
};
