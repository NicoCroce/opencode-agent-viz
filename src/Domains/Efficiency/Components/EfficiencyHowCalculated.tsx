import { Container } from '@app/Application/Components';
import {
  Disclosure,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import { formatPercent } from '@app/Application/Helpers';
import type {
  TDimensionKey,
  TDimensionResult,
  TEfficiencyReport,
  TIndicatorKey,
  TIndicatorResult,
  TOmission,
} from '../Efficiency.entity';
import { factorImpact } from '../lib/factors';
import {
  BAND_LABEL,
  CONFIDENCE_LABEL,
  DIMENSION_LABEL,
  INDICATOR_LABEL,
} from '../lib/labels';
import { buildOmissions } from '../lib/omissions';
import {
  BAND_MINIMUMS,
  CACHE_OMISSION_PENALTY,
  HIGH_CONFIDENCE_MIN_COVERAGE,
  INDICATOR_WEIGHTS,
  MEDIUM_CONFIDENCE_MIN_COVERAGE,
} from '../lib/thresholds';

/** Datos mínimos del informe que explica “Cómo se calcula”. */
export type THowCalculatedData = Pick<
  TEfficiencyReport,
  'status' | 'dimensions' | 'coverage' | 'confidence' | 'notes'
>;

export interface EfficiencyHowCalculatedProps {
  report: THowCalculatedData;
  /** Omisiones ya derivadas; si se omiten, se calculan del propio informe. */
  omissions?: TOmission[];
}

const MAX_POINTS = 100;

/** Regla de bandas visible (FR-014); los cortes viven en `thresholds.ts`. */
const BAND_RULES = [
  `${BAND_MINIMUMS.eficiente}–${MAX_POINTS} ${BAND_LABEL.eficiente}`,
  `${BAND_MINIMUMS.aceptable}–${BAND_MINIMUMS.eficiente - 1} ${BAND_LABEL.aceptable}`,
  `${BAND_MINIMUMS.mejorable}–${BAND_MINIMUMS.aceptable - 1} ${BAND_LABEL.mejorable}`,
  `${BAND_MINIMUMS.friccion}–${BAND_MINIMUMS.mejorable - 1} ${BAND_LABEL.friccion}`,
].join(' · ');

const indicatorWeight = (
  dimension: TDimensionKey,
  indicator: TIndicatorKey,
): number => {
  const weights = INDICATOR_WEIGHTS[dimension] as Partial<
    Record<TIndicatorKey, number>
  >;
  return weights[indicator] ?? 0;
};

const formatRatio = (value: number): string => value.toFixed(2);

const formatPoints = (value: number): string => {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
};

const formatDimensionValue = (
  dimension: TDimensionResult,
  status: TEfficiencyReport['status'],
): string => {
  if (status !== 'ok') return 'sin nota';
  if (!dimension.available || dimension.value === null) return 'omitida';
  return Number.isInteger(dimension.value)
    ? String(dimension.value)
    : dimension.value.toFixed(1);
};

const indicatorSample = (indicator: TIndicatorResult): string =>
  indicator.minimum > 0
    ? `${indicator.count} / ${indicator.minimum}`
    : String(indicator.count);

const omissionLabel = (omission: TOmission): string =>
  omission.indicator === 'CACHE' ? 'Caché' : DIMENSION_LABEL[omission.key];

const omissionLoss = (omission: TOmission): string =>
  `pierde ${formatPoints(omission.weight)} puntos`;

const coverageDigits = (coverage: number): number =>
  Number.isInteger(coverage) ? 0 : 1;

/**
 * “Cómo se calcula” (FR-014/FR-016/FR-021; contrato overlay §5.5).
 *
 * Explica con cifras trazables el veredicto: pesos de dimensión e indicador,
 * muestra y mínimo, `r`, `cap`, aporte y puntos perdidos; cobertura, omisiones,
 * regla de confianza, bandas y notas del motor. Con `status !== 'ok'` no pinta
 * valores de dimensión que puedan confundirse con una nota: solo pesos,
 * cobertura y omisiones.
 *
 * Presentación pura: no accede a datos ni al SDK. Las omisiones se reciben ya
 * derivadas o se construyen con la función pura del dominio.
 */
export const EfficiencyHowCalculated = ({
  report,
  omissions,
}: EfficiencyHowCalculatedProps) => {
  const { status, dimensions, coverage, confidence, notes } = report;
  const activeOmissions = omissions ?? buildOmissions(dimensions);
  const coverageLabel = formatPercent(coverage, coverageDigits(coverage));
  const confidenceLabel =
    confidence === null ? 'no disponible' : CONFIDENCE_LABEL[confidence];

  return (
    <Disclosure title="Cómo se calcula" expandedTitle="Ocultar cálculo">
      <Container space="medium">
        <Container space="small">
          <SectionHeading>Pesos por dimensión</SectionHeading>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-left text-xs">
              <caption className="sr-only">
                Pesos y valores de las dimensiones
              </caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 font-medium">
                    Dimensión
                  </th>
                  <th scope="col" className="py-1 pr-2 font-medium">
                    Peso
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {dimensions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-1 text-muted-foreground">
                      Sin dimensiones calculadas.
                    </td>
                  </tr>
                ) : (
                  dimensions.map((dimension) => (
                    <tr
                      key={dimension.key}
                      className="border-b border-border/60"
                    >
                      <td className="py-1 pr-2 text-foreground">
                        {DIMENSION_LABEL[dimension.key]}
                      </td>
                      <td className="py-1 pr-2 font-mono tabular-nums text-muted-foreground">
                        {dimension.weight}
                      </td>
                      <td className="py-1 font-mono tabular-nums text-muted-foreground">
                        {formatDimensionValue(dimension, status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Container>

        <Container space="small">
          <SectionHeading>Cobertura</SectionHeading>
          <p className="text-xs text-muted-foreground">
            Cobertura: {coverageLabel}. Suma de los pesos de las dimensiones
            disponibles; si la caché se omite, resta{' '}
            {formatPoints(CACHE_OMISSION_PENALTY)} puntos.
          </p>
        </Container>

        <Container space="small">
          <SectionHeading>Omisiones</SectionHeading>
          {activeOmissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin omisiones: todas las dimensiones participan en la nota.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {activeOmissions.map((omission) => (
                <li
                  key={`${omission.key}-${omission.indicator ?? 'dimension'}`}
                  className="min-w-0 break-words"
                >
                  <span className="font-medium text-foreground">
                    {omissionLabel(omission)}
                  </span>{' '}
                  · {omission.reason} · {omissionLoss(omission)}.
                </li>
              ))}
            </ul>
          )}
        </Container>

        {dimensions.map((dimension) => (
          <Container key={dimension.key} space="small">
            <SectionHeading>
              Indicadores de {DIMENSION_LABEL[dimension.key]} · peso{' '}
              {dimension.weight}
            </SectionHeading>
            {dimension.indicators.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin indicadores evaluados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Indicadores de {DIMENSION_LABEL[dimension.key]}: muestra,
                    mínimo, r, cap, aporte y puntos perdidos
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="py-1 pr-2 font-medium">
                        Indicador
                      </th>
                      <th scope="col" className="py-1 pr-2 font-medium">
                        Peso
                      </th>
                      <th scope="col" className="py-1 pr-2 font-medium">
                        Muestra / mínimo
                      </th>
                      <th scope="col" className="py-1 pr-2 font-medium">
                        r
                      </th>
                      <th scope="col" className="py-1 pr-2 font-medium">
                        cap
                      </th>
                      <th scope="col" className="py-1 pr-2 font-medium">
                        Aporte
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        Puntos perdidos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimension.indicators.map((indicator) => (
                      <tr
                        key={indicator.key}
                        className="border-b border-border/60"
                      >
                        <td className="py-1 pr-2 text-foreground">
                          {INDICATOR_LABEL[indicator.key]}
                        </td>
                        <td className="py-1 pr-2 font-mono tabular-nums text-muted-foreground">
                          {formatPercent(
                            indicatorWeight(dimension.key, indicator.key) * 100,
                          )}
                        </td>
                        <td className="py-1 pr-2 font-mono tabular-nums text-muted-foreground">
                          {indicatorSample(indicator)}
                        </td>
                        <td className="py-1 pr-2 font-mono tabular-nums text-muted-foreground">
                          {formatRatio(indicator.ratio)}
                        </td>
                        <td className="py-1 pr-2 font-mono tabular-nums text-muted-foreground">
                          {formatRatio(indicator.cap)}
                        </td>
                        <td className="py-1 pr-2 font-mono tabular-nums text-muted-foreground">
                          {formatPercent(indicator.score * 100)}
                        </td>
                        <td className="py-1 font-mono tabular-nums text-muted-foreground">
                          {status === 'ok' && dimension.available
                            ? formatPoints(factorImpact(dimension, indicator))
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Container>
        ))}

        <Container space="small">
          <SectionHeading>Confianza</SectionHeading>
          <p className="text-xs text-muted-foreground">
            Confianza {confidenceLabel}. Alta con cobertura ≥
            {HIGH_CONFIDENCE_MIN_COVERAGE}% y el doble del mínimo de muestra en
            todas las dimensiones disponibles; media desde{' '}
            {MEDIUM_CONFIDENCE_MIN_COVERAGE}%; baja por debajo de{' '}
            {MEDIUM_CONFIDENCE_MIN_COVERAGE}% o con subárbol parcial.
          </p>
        </Container>

        <Container space="small">
          <SectionHeading>Bandas</SectionHeading>
          <p className="text-xs text-muted-foreground">{BAND_RULES}.</p>
        </Container>

        <Container space="small">
          <SectionHeading>Notas del motor</SectionHeading>
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin notas.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {notes.map((note) => (
                <li key={note} className="min-w-0 break-words">
                  {note}
                </li>
              ))}
            </ul>
          )}
        </Container>

        <Container space="small" className="text-xs text-muted-foreground">
          <p>Coste y latencia se muestran; no puntúan.</p>
          <p>Totales derivados de mensajes; no incluyen compactación.</p>
        </Container>
      </Container>
    </Disclosure>
  );
};
