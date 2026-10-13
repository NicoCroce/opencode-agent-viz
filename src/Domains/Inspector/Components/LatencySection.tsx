import { Container } from '@app/Application/Components';
import {
  DetailRow,
  SectionFrame,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import {
  formatDuration,
  formatPercent,
  formatSpeedup,
} from '@app/Application/Helpers';
import { formatClock } from '@app/Application/Helpers/format/clock';
import { cn } from '@app/Application/lib/utils';
import type {
  TLatencyAnomaly,
  TLatencyReport,
  TLatencySample,
} from '@app/Domains/Graph/Graph.entity';

/** Etiquetas legibles del origen de la referencia (FR-020). */
const REFERENCE_LABEL: Record<'node' | 'agent', string> = {
  node: 'mediana del nodo',
  agent: 'mediana del agente',
};

/** Etiquetas legibles de la dirección de la anomalía (FR-021). */
const DIRECTION_LABEL: Record<'slow' | 'fast', string> = {
  slow: 'Lenta',
  fast: 'Rápida',
};

/** Rango del control de umbral, en puntos porcentuales (contrato §4). */
const THRESHOLD_MIN_PCT = 5;
const THRESHOLD_MAX_PCT = 95;
const THRESHOLD_STEP_PCT = 5;

interface LatencySectionProps {
  /** Serie de latencia del nodo; `null`/vacía hasta el enriquecimiento (US5). */
  latency: TLatencyReport | null;
  /** Umbral vigente (±fracción) (FR-022). */
  threshold: number;
  /** Cambia el umbral; el hook lo acota y persiste antes de propagarlo. */
  onThresholdChange: (value: number) => void;
  isError?: boolean;
  isLoading?: boolean;
}

/**
 * Apartado **Latencia** del panel de contexto (FR-018..FR-023;
 * `contracts/context-panel-contract.md` §4). Muestra la serie de TTFT y latencia
 * total por respuesta, la mediana de referencia (nodo o agente) y la lista de
 * anomalías con su magnitud (`ratio`), la referencia usada y su origen. Incluye
 * el control de umbral configurable (FR-022) y resuelve los cuatro estados de
 * pantalla vía `SectionFrame`. Presentación pura: el umbral llega por props.
 */
export const LatencySection = ({
  latency,
  threshold,
  onThresholdChange,
  isError = false,
  isLoading = false,
}: LatencySectionProps) => {
  const reference = latency?.reference ?? null;
  const referenceMs = latency?.medianMs ?? null;
  const thresholdPct = Math.round(threshold * 100);

  const anomalyByStep = new Map<string, TLatencyAnomaly>(
    (latency?.anomalies ?? []).map((anomaly) => [anomaly.stepId, anomaly]),
  );

  return (
    <SectionFrame
      title="Latencia"
      isError={isError}
      isLoading={isLoading}
      isEmpty={!latency || latency.samples.length === 0}
      emptyLabel="Sin respuestas medidas"
      data-testid="latency-section"
    >
      <Container space="small">
        <Container space="none" className="gap-0.5">
          <DetailRow
            label="Referencia"
            value={
              referenceMs === null
                ? null
                : `${formatDuration(referenceMs)}${
                    reference ? ` · ${REFERENCE_LABEL[reference]}` : ''
                  }`
            }
          />
        </Container>

        <Container space="small">
          <label
            htmlFor="anomaly-threshold"
            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            Umbral de anomalía
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
              aria-label={`Umbral de anomalía ±${thresholdPct}%`}
              className="h-6 w-full cursor-pointer accent-primary"
            />
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
              {`±${formatPercent(thresholdPct, 0)}`}
            </span>
          </Container>
        </Container>

        <Container space="none" className="gap-0.5" role="list">
          <SectionHeading>Respuestas</SectionHeading>
          {(latency?.samples ?? []).map((sample: TLatencySample, index) => {
            const anomaly = anomalyByStep.get(sample.stepId);
            return (
              <Container
                key={sample.stepId}
                row
                align="center"
                justify="between"
                space="small"
                role="listitem"
                className="min-w-0 gap-2 font-mono text-[11px] tabular-nums"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {`#${index + 1} · ${formatClock(sample.startedAt)}`}
                </span>
                <Container
                  row
                  align="center"
                  space="small"
                  className="shrink-0 gap-2"
                >
                  <span className="text-foreground/80">
                    {`TTFT ${formatDuration(sample.ttftMs)}`}
                  </span>
                  <span className="text-foreground">
                    {`total ${formatDuration(sample.totalMs)}`}
                  </span>
                  {anomaly ? (
                    <span
                      className={cn(
                        'rounded-flat border px-1 text-[10px]',
                        anomaly.direction === 'slow'
                          ? 'border-status-error/80 text-status-error'
                          : 'border-status-waiting/80 text-status-waiting',
                      )}
                    >
                      {DIRECTION_LABEL[anomaly.direction]}
                    </span>
                  ) : null}
                </Container>
              </Container>
            );
          })}
        </Container>

        {latency && latency.anomalies.length > 0 ? (
          <Container space="none" className="gap-0.5" role="list">
            <SectionHeading>Anomalías</SectionHeading>
            {latency.anomalies.map((anomaly) => (
              <Container
                key={anomaly.stepId}
                row
                align="center"
                justify="between"
                space="small"
                role="listitem"
                className="min-w-0 gap-2 font-mono text-[11px] tabular-nums"
              >
                <span
                  className={cn(
                    'min-w-0 truncate',
                    anomaly.direction === 'slow'
                      ? 'text-status-error'
                      : 'text-status-waiting',
                  )}
                >
                  {DIRECTION_LABEL[anomaly.direction]}
                </span>
                <span className="shrink-0 text-foreground">
                  {`${formatSpeedup(anomaly.ratio)} · ${formatDuration(
                    anomaly.referenceMs,
                  )} · ${REFERENCE_LABEL[anomaly.reference]}`}
                </span>
              </Container>
            ))}
          </Container>
        ) : null}
      </Container>
    </SectionFrame>
  );
};
