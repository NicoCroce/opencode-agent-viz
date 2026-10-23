import { Container } from '@app/Application/Components';
import { formatClock } from '@app/Application/Helpers/format/clock';
import type { TRuleId, TTurnAnalysis } from '../Efficiency.entity';
import { INDICATOR_LABEL } from '../lib/labels';

interface EfficiencyTurnDetailProps {
  /** Turno expandido; el prompt se muestra completo (FR-033). */
  turn: TTurnAnalysis;
}

/** Copy del detalle; no se reutiliza en la fila colapsada. */
const TURN_DETAIL_LABEL = {
  prompt: 'Prompt completo',
  evidence: 'Evidencia',
  signals: 'Señales del turno',
  noSignals: 'Sin señales',
} as const;

/**
 * Nombres visibles de las reglas que también son indicadores (FR-023). Las
 * señales sin nombre propio (INP-4, RES-5, RES-6) se muestran solo con su id.
 */
const RULE_LABEL: Partial<Record<TRuleId, string>> = INDICATOR_LABEL;

/**
 * Detalle expandido de un turno (FR-033, contrato §5.4): prompt completo, la
 * cita/evidencia del `user` que lo abrió y las señales atribuidas a la ventana.
 *
 * Presentación pura y sin estado: solo se monta cuando la fila o la tarjeta
 * están expandidas, de modo que el texto completo nunca está en el DOM antes
 * de la expansión (FR-030).
 */
export const EfficiencyTurnDetail = ({ turn }: EfficiencyTurnDetailProps) => (
  <Container space="small" className="min-w-0 text-sm">
    <section aria-label={TURN_DETAIL_LABEL.prompt}>
      <p className="text-xs font-semibold text-muted-foreground">
        {TURN_DETAIL_LABEL.prompt}
      </p>
      <p className="whitespace-pre-wrap break-words">{turn.prompt}</p>
    </section>

    <section aria-label={TURN_DETAIL_LABEL.evidence}>
      <p className="text-xs font-semibold text-muted-foreground">
        {TURN_DETAIL_LABEL.evidence}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        {`Turno ${turn.index} · ${turn.userMessageId} · ${formatClock(turn.at)}`}
      </p>
    </section>

    <section aria-label={TURN_DETAIL_LABEL.signals}>
      <p className="text-xs font-semibold text-muted-foreground">
        {TURN_DETAIL_LABEL.signals}
      </p>
      {turn.signals.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {TURN_DETAIL_LABEL.noSignals}
        </p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {turn.signals.map((ruleId) => {
            const label = RULE_LABEL[ruleId];
            return (
              <li key={ruleId}>
                <span className="font-mono">{ruleId}</span>
                {label === undefined ? null : ` · ${label}`}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  </Container>
);
