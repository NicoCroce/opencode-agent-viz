import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
  faCircleExclamation,
  faCircleInfo,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { Container } from '@app/Application/Components';
import {
  Disclosure,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import { cn } from '@app/Application/lib/utils';
import type { TFinding, TSeverity } from '../Efficiency.entity';
import { SEVERITY_LABEL } from '../lib/labels';
import { codePointLength, truncateCodePoints } from '../lib/text';
import { PROMPT_TRUNCATE_CODE_POINTS } from '../lib/thresholds';

export interface EfficiencyFindingCardProps {
  /** Hallazgo ya ordenado por el motor; la tarjeta no reordena ni puntúa. */
  finding: TFinding;
}

/** Icono por severidad: el nivel se comunica con texto + icono, nunca solo color. */
const SEVERITY_ICON: Record<TSeverity, IconDefinition> = {
  alta: faCircleExclamation,
  media: faTriangleExclamation,
  baja: faCircleInfo,
};

/** Tono por severidad con tokens del tema; sin rojo (FR-027/R11). */
const SEVERITY_TONE: Record<TSeverity, string> = {
  alta: 'text-status-waiting',
  media: 'text-status-waiting',
  baja: 'text-muted-foreground',
};

/** Copy de la tarjeta; las etiquetas visibles viven aquí (sin magic strings). */
const FINDING_CARD_LABEL = {
  severity: 'Severidad',
  condition: 'Condición',
  quote: 'Cita',
  recommendation: 'Recomendación',
  expandQuote: 'Ver cita completa',
  collapseQuote: 'Ocultar cita completa',
} as const;

/**
 * Tarjeta de un hallazgo (FR-023/FR-028/FR-030; contrato overlay §5.3).
 *
 * Muestra el `ruleId` estable, la severidad con texto + icono, la condición
 * medida, la cita con su ancla y la recomendación. La cita se recorta a 120
 * code points; el texto completo se monta **solo** al expandir el `Disclosure`
 * (render condicional, nunca tooltip ni botón de copia).
 *
 * Presentación pura: recibe el hallazgo ya calculado y no accede a datos.
 */
export const EfficiencyFindingCard = ({
  finding,
}: EfficiencyFindingCardProps) => {
  const isLongQuote =
    codePointLength(finding.quote) > PROMPT_TRUNCATE_CODE_POINTS;
  const severityLabel = SEVERITY_LABEL[finding.severity];

  return (
    <article
      aria-label={`Hallazgo ${finding.ruleId}`}
      className="min-w-0 break-words rounded-flat border border-border bg-surface-1 p-3"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs font-semibold text-foreground">
          {finding.ruleId}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            SEVERITY_TONE[finding.severity],
          )}
        >
          <FontAwesomeIcon
            icon={SEVERITY_ICON[finding.severity]}
            aria-hidden
            className="size-3 shrink-0"
          />
          {`${FINDING_CARD_LABEL.severity} ${severityLabel}`}
        </span>
      </header>

      <Container space="small" className="mt-2">
        <SectionHeading>{FINDING_CARD_LABEL.condition}</SectionHeading>
        <p className="min-w-0 break-words text-xs text-foreground">
          {finding.condition}
        </p>

        <SectionHeading>{FINDING_CARD_LABEL.quote}</SectionHeading>
        <blockquote className="min-w-0 break-words border-l-2 border-border pl-2 text-xs text-muted-foreground">
          <p>
            {truncateCodePoints(finding.quote, PROMPT_TRUNCATE_CODE_POINTS)}
          </p>
          {isLongQuote ? (
            <Disclosure
              title={FINDING_CARD_LABEL.expandQuote}
              expandedTitle={FINDING_CARD_LABEL.collapseQuote}
            >
              <p>{finding.quote}</p>
            </Disclosure>
          ) : null}
        </blockquote>

        <SectionHeading>{FINDING_CARD_LABEL.recommendation}</SectionHeading>
        <p className="min-w-0 break-words text-xs text-foreground">
          {finding.recommendation}
        </p>
      </Container>
    </article>
  );
};
