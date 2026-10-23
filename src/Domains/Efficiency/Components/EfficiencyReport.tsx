import { Container } from '@app/Application/Components';
import { Alert } from '@app/Application/Components/Molecules/Alert';
import { SectionHeading } from '@app/Application/Components/Molecules';
import { formatPercent } from '@app/Application/Helpers';
import type {
  TEfficiencyReference,
  TEfficiencyReport,
  TOmission,
  TTurnAnalysis,
} from '../Efficiency.entity';
import { buildFactors } from '../lib/factors';
import { DIMENSION_LABEL } from '../lib/labels';
import { buildOmissions } from '../lib/omissions';
import { MIN_CLOSED_TURNS, MIN_COVERAGE } from '../lib/thresholds';
import { EfficiencyFactors } from './EfficiencyFactors';
import { EfficiencyFindings } from './EfficiencyFindings';
import { EfficiencyHowCalculated } from './EfficiencyHowCalculated';
import { EfficiencyTotals } from './EfficiencyTotals';
import { EfficiencyTurns } from './EfficiencyTurns';
import { EfficiencyVerdict } from './EfficiencyVerdict';

export interface EfficiencyReportProps {
  /** Informe ya calculado por el motor puro; nunca se recalcula aquí. */
  report: TEfficiencyReport;
  /** Resumen de la cabecera para el contraste de totales (opcional). */
  reference?: TEfficiencyReference | null;
  /** Presentación de la sección de turnos: tabla (false) o tarjetas (true). */
  isMobile: boolean;
}

/** Copy exacto del banner de guarda en curso (contrato overlay §4). */
const IN_PROGRESS_MESSAGE = 'Sesión en curso: sin nota';

/** Copy exacto del título del banner de muestra insuficiente. */
const INSUFFICIENT_TITLE = 'Muestra insuficiente';

/** Motivo de reserva si el informe no expone ninguna de las dos causas. */
const INSUFFICIENT_FALLBACK = 'Sin muestra suficiente para puntuar.';

const coverageDigits = (coverage: number): number =>
  Number.isInteger(coverage) ? 0 : 1;

const countClosedTurns = (turns: TTurnAnalysis[]): number =>
  turns.filter((turn) => turn.closed).length;

const omissionLabel = (omission: TOmission): string =>
  omission.indicator === 'CACHE' ? 'Caché' : DIMENSION_LABEL[omission.key];

/**
 * Motivo visible de la guarda `insufficient`: turnos cerrados y/o cobertura
 * (data-model §4.5). Las dos condiciones pueden darse a la vez y ambas se
 * declaran; los umbrales salen de `thresholds.ts`, nunca de un literal local.
 */
const insufficientMotive = (report: TEfficiencyReport): string => {
  const closedTurns = countClosedTurns(report.turns);
  const reasons: string[] = [];

  if (closedTurns < MIN_CLOSED_TURNS) {
    reasons.push(
      `Menos de ${MIN_CLOSED_TURNS} turnos cerrados (${closedTurns}).`,
    );
  }

  if (report.coverage < MIN_COVERAGE) {
    reasons.push(
      `Cobertura inferior al ${MIN_COVERAGE}% (${formatPercent(
        report.coverage,
        coverageDigits(report.coverage),
      )}).`,
    );
  }

  return reasons.length > 0 ? reasons.join(' ') : INSUFFICIENT_FALLBACK;
};

/**
 * Banner de guarda del informe (contrato overlay §4): informativo, no una
 * alerta que interrumpa, así que se anuncia con `role="status"`.
 */
const GuardBanner = ({ report }: { report: TEfficiencyReport }) =>
  report.status === 'in_progress' ? (
    <Alert
      variant="info"
      role="status"
      ariaLive="polite"
      message={IN_PROGRESS_MESSAGE}
    />
  ) : (
    <Alert
      variant="info"
      role="status"
      ariaLive="polite"
      title={INSUFFICIENT_TITLE}
      message={insufficientMotive(report)}
    />
  );

/**
 * Métricas crudas de la guarda: cobertura, conteo de turnos y dimensiones
 * omitidas con su motivo. Es la misma información que detalla “Cómo se
 * calcula”, pero visible sin desplegar el `Disclosure`.
 */
const GuardData = ({ report }: { report: TEfficiencyReport }) => {
  const omissions = buildOmissions(report.dimensions);
  const closedTurns = countClosedTurns(report.turns);
  const coverage = formatPercent(
    report.coverage,
    coverageDigits(report.coverage),
  );

  return (
    <Container space="small">
      <SectionHeading>Datos disponibles</SectionHeading>

      <Container space="small" className="text-xs text-muted-foreground">
        <p>Cobertura {coverage}.</p>
        <p>
          Turnos cerrados {closedTurns} de {report.turns.length}.
        </p>

        <p>Dimensiones omitidas</p>
        {omissions.length === 0 ? (
          <p>Sin dimensiones omitidas.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {omissions.map((omission) => (
              <li
                key={`${omission.key}-${omission.indicator ?? 'dimension'}`}
                className="min-w-0 break-words"
              >
                <span className="font-medium text-foreground">
                  {omissionLabel(omission)}
                </span>{' '}
                · {omission.reason}.
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Container>
  );
};

/**
 * Orquestador de presentación del informe de eficiencia (contrato overlay §4–§5).
 *
 * Compone el veredicto, los factores de impacto, los hallazgos, “Cómo se
 * calcula” y los totales a partir del `report` recibido. No hace fetch, no
 * consulta el SDK ni gestiona estados de carga/error propios: el overlay
 * resuelve esos estados antes de montarlo (contrato §4).
 *
 * Guardas (`in_progress`/`insufficient`, contrato §4): se pinta el banner de
 * estado, la cobertura, las dimensiones omitidas, los conteos y los totales
 * crudos; nunca nota, valores de dimensión ni hallazgos. `no_data` no se
 * renderiza como informe: el overlay monta su `EmptyState` (contrato §4).
 *
 * Los turnos salen tal cual de `report.turns`: el motor ya los segmenta por el
 * `user` de la raíz, así que nunca se mezclan pedidos de subagentes como
 * humanos (FR-035). No se filtran ni reordenan aquí.
 *
 * `isMobile` se recibe ya resuelto por la página (`useDevice`) para que la
 * sección de turnos no duplique lógica ni use `md:hidden`.
 */
export const EfficiencyReport = ({
  report,
  reference,
  isMobile,
}: EfficiencyReportProps) => {
  if (report.status === 'no_data') return null;

  const isScored = report.status === 'ok';

  return (
    <Container space="large">
      {isScored ? (
        <>
          <EfficiencyVerdict report={report} />
          <EfficiencyFactors factors={buildFactors(report.dimensions)} />
          <EfficiencyFindings
            findings={report.findings}
            weakSignals={report.weakSignals}
          />
        </>
      ) : (
        <>
          <GuardBanner report={report} />
          <GuardData report={report} />
        </>
      )}
      <EfficiencyTurns turns={report.turns} isMobile={isMobile} />
      <EfficiencyHowCalculated report={report} />
      <EfficiencyTotals totals={report.totals} reference={reference} />
    </Container>
  );
};
