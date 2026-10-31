import {
  CircleAlert,
  CircleCheck,
  ThumbsUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Container } from '@app/Application/Components';
import { formatPercent } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TBand, TEfficiencyReport } from '../Efficiency.entity';
import { BAND_LABEL, CONFIDENCE_LABEL } from '../lib/labels';

/** Datos mínimos del informe que pinta el veredicto (contrato overlay §5.2). */
export type TVerdictData = Pick<
  TEfficiencyReport,
  'score' | 'band' | 'coverage' | 'confidence'
>;

export interface EfficiencyVerdictProps {
  report: TVerdictData;
}

/** Icono por banda: la señal nunca depende solo del color (FR-041). */
const BAND_ICON: Record<TBand, LucideIcon> = {
  eficiente: CircleCheck,
  aceptable: ThumbsUp,
  mejorable: TriangleAlert,
  friccion: CircleAlert,
};

/** Tono por banda con tokens del tema; nunca rojo (R11). */
const BAND_TONE: Record<TBand, string> = {
  eficiente: 'text-status-done',
  aceptable: 'text-foreground',
  mejorable: 'text-status-waiting',
  friccion: 'text-status-waiting',
};

const CONFIDENCE_PREFIX = 'confianza';

/**
 * Veredicto del informe (FR-008; contrato overlay §5.2): nota entera grande,
 * banda con texto + icono, cobertura y confianza. Presentación pura: recibe los
 * campos ya calculados y no accede a datos ni al SDK.
 *
 * El nombre accesible de la nota es exacto —"{score} de 100, {banda}"— y el
 * icono de la banda es decorativo. Sin nota (`score === null`, en curso o
 * insuficiente) no se pinta nada: el banner de estado y la cobertura cruda los
 * aporta `EfficiencyReport` (contrato §4).
 */
export const EfficiencyVerdict = ({ report }: EfficiencyVerdictProps) => {
  const { score, band, coverage, confidence } = report;

  if (score === null || band === null) return null;

  const bandLabel = BAND_LABEL[band];
  const BandIcon = BAND_ICON[band];
  const coverageDigits = Number.isInteger(coverage) ? 0 : 1;
  const coverageLabel = formatPercent(coverage, coverageDigits);

  return (
    <Container space="small">
      <Container row align="center" space="small" className="flex-wrap">
        <span
          role="img"
          aria-label={`${score} de 100, ${bandLabel}`}
          className="font-mono text-4xl font-semibold leading-none tabular-nums text-foreground"
        >
          {score}
        </span>

        <span
          aria-hidden
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium',
            BAND_TONE[band],
          )}
        >
          <BandIcon className="size-3.5" />
          {bandLabel}
        </span>
      </Container>

      <Container
        row
        align="center"
        space="medium"
        className="flex-wrap text-xs text-muted-foreground"
      >
        <span>Cobertura {coverageLabel}</span>
        {confidence !== null ? (
          <span>
            {CONFIDENCE_PREFIX} {CONFIDENCE_LABEL[confidence]}
          </span>
        ) : null}
      </Container>
    </Container>
  );
};
