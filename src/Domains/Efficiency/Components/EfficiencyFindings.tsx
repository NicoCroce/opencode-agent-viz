import { Container } from '@app/Application/Components';
import {
  Disclosure,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import type { TFinding } from '../Efficiency.entity';
import { EfficiencyFindingCard } from './EfficiencyFindingCard';

export interface EfficiencyFindingsProps {
  /** Hallazgos penalizantes, ya ordenados por impacto por el motor. */
  findings: TFinding[];
  /** Señales que no restan; van en su propia sección. */
  weakSignals: TFinding[];
}

/**
 * Máximo de hallazgos visibles sin expandir (contrato overlay §5.3: 2–5 por
 * impacto). El resto se monta bajo “Ver N hallazgos más”.
 */
const VISIBLE_FINDINGS = 5;

/** Copy de la sección; las etiquetas visibles viven aquí (sin magic strings). */
const FINDINGS_LABEL = {
  heading: 'Hallazgos',
  empty: 'Sin hallazgos',
  weakHeading: 'Señales (no restan)',
  weakEmpty: 'Sin señales débiles',
  expand: (count: number) => `Ver ${count} hallazgos más`,
  collapse: 'Ver menos',
} as const;

const findingKey = (finding: TFinding): string =>
  `${finding.ruleId}-${finding.evidence.messageId ?? 'sin-ancla'}`;

const FindingList = ({ findings }: { findings: TFinding[] }) => (
  <ul className="flex min-w-0 flex-col gap-2">
    {findings.map((finding) => (
      <li key={findingKey(finding)} className="min-w-0">
        <EfficiencyFindingCard finding={finding} />
      </li>
    ))}
  </ul>
);

/**
 * Sección de hallazgos y señales débiles (FR-019/FR-025/FR-026; contrato
 * overlay §5.3).
 *
 * Pinta primero los penalizantes en el orden del motor, con un máximo de cinco
 * visibles y el resto bajo `Disclosure` “Ver N hallazgos más”; las señales
 * débiles nunca se mezclan con ellos y viven en “Señales (no restan)”. Los
 * vacíos se declaran con texto (“Sin hallazgos” / “Sin señales débiles”), no
 * como un hueco.
 *
 * Presentación pura: no ordena, no puntúa ni accede a datos.
 */
export const EfficiencyFindings = ({
  findings,
  weakSignals,
}: EfficiencyFindingsProps) => {
  const visibleFindings = findings.slice(0, VISIBLE_FINDINGS);
  const hiddenFindings = findings.slice(VISIBLE_FINDINGS);

  return (
    <Container space="medium">
      <Container space="small">
        <SectionHeading>{FINDINGS_LABEL.heading}</SectionHeading>
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {FINDINGS_LABEL.empty}
          </p>
        ) : (
          <>
            <FindingList findings={visibleFindings} />
            {hiddenFindings.length > 0 ? (
              <Disclosure
                title={FINDINGS_LABEL.expand(hiddenFindings.length)}
                expandedTitle={FINDINGS_LABEL.collapse}
              >
                <FindingList findings={hiddenFindings} />
              </Disclosure>
            ) : null}
          </>
        )}
      </Container>

      <Container space="small">
        <SectionHeading>{FINDINGS_LABEL.weakHeading}</SectionHeading>
        {weakSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {FINDINGS_LABEL.weakEmpty}
          </p>
        ) : (
          <FindingList findings={weakSignals} />
        )}
      </Container>
    </Container>
  );
};
