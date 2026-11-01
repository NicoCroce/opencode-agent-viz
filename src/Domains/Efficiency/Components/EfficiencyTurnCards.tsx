import { useId, useState } from 'react';
import { Badge, Button, Container } from '@app/Application/Components';
import { UnavailableValue } from '@app/Application/Components/Molecules';
import { formatCost } from '@app/Application/Helpers/formatCost';
import { formatDuration } from '@app/Application/Helpers/formatDuration';
import type { TTurnAnalysis } from '../Efficiency.entity';
import { OUTCOME_LABEL, TURN_LABEL } from '../lib/labels';
import { codePointLength, truncateCodePoints } from '../lib/text';
import { PROMPT_TRUNCATE_CODE_POINTS } from '../lib/thresholds';
import { EfficiencyTurnDetail } from './EfficiencyTurnDetail';

interface EfficiencyTurnCardsProps {
  /** Turnos del informe; se ordenan por `index` antes de pintar. */
  turns: TTurnAnalysis[];
}

interface TurnCardProps {
  turn: TTurnAnalysis;
}

/**
 * Tarjeta de un turno en móvil (FR-034, contrato overlay §5.4): los mismos
 * campos esenciales que la fila de la tabla y el mismo detalle expandible. El
 * estado de expansión es local y el prompt completo solo se monta al expandir
 * (FR-030/FR-033).
 */
const TurnCard = ({ turn }: TurnCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const titleId = useId();
  const isLongPrompt =
    codePointLength(turn.prompt) > PROMPT_TRUNCATE_CODE_POINTS;

  return (
    <article
      aria-labelledby={titleId}
      className="min-w-0 break-words rounded-flat border border-border bg-surface-1 p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3
          id={titleId}
          className="min-w-0 font-mono text-sm font-semibold text-foreground"
        >
          {`${TURN_LABEL.turn} ${turn.index}`}
        </h3>
        {turn.closed ? null : (
          <Badge variant="secondary">{TURN_LABEL.open}</Badge>
        )}
      </header>

      <Container space="small" className="mt-2 min-w-0 text-sm">
        <p className="text-xs font-semibold text-muted-foreground">
          {TURN_LABEL.prompt}
        </p>
        <p className="break-words">
          {truncateCodePoints(turn.prompt, PROMPT_TRUNCATE_CODE_POINTS)}
        </p>

        {isLongPrompt ? (
          <Button
            variant="link"
            className="h-auto! self-start p-0! text-xs"
            aria-expanded={expanded}
            aria-controls={expanded ? detailId : undefined}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? TURN_LABEL.collapse : TURN_LABEL.expand}
          </Button>
        ) : null}

        <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">
            {TURN_LABEL.clarifications}
          </dt>
          <dd className="text-right tabular-nums">{turn.clarifications}</dd>

          <dt className="text-muted-foreground">{TURN_LABEL.outcome}</dt>
          <dd className="min-w-0 text-right">
            {turn.outcome === null ? (
              <UnavailableValue label={TURN_LABEL.unavailableOutcome} />
            ) : (
              OUTCOME_LABEL[turn.outcome]
            )}
          </dd>

          <dt className="text-muted-foreground">{TURN_LABEL.cost}</dt>
          <dd className="min-w-0 text-right">
            {turn.cost === null ? (
              <UnavailableValue label={TURN_LABEL.unavailableCost} />
            ) : (
              formatCost(turn.cost)
            )}
          </dd>

          <dt className="text-muted-foreground">{TURN_LABEL.time}</dt>
          <dd className="min-w-0 text-right">
            {turn.durationMs === null ? (
              <UnavailableValue label={TURN_LABEL.unavailableTime} />
            ) : (
              formatDuration(turn.durationMs)
            )}
          </dd>

          <dt className="text-muted-foreground">{TURN_LABEL.signals}</dt>
          <dd className="min-w-0 text-right">
            {turn.signals.length === 0 ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">{TURN_LABEL.noSignals}</span>
              </>
            ) : (
              <span className="break-words font-mono text-xs">
                {turn.signals.join(', ')}
              </span>
            )}
          </dd>
        </dl>
      </Container>

      {expanded && isLongPrompt ? (
        <div
          id={detailId}
          role="region"
          aria-label={`Detalle del turno ${turn.index}`}
          className="mt-2 border-t border-border pt-2"
        >
          <EfficiencyTurnDetail turn={turn} />
        </div>
      ) : null}
    </article>
  );
};

/**
 * Tarjetas cronológicas de turnos en móvil (FR-034/FR-035, contrato §5.4): un
 * `<article>` por turno, sin tabla ancha ni scroll horizontal. La fuente de
 * datos es la misma que la de `EfficiencyTurnTable`; el selector entre ambas
 * presentaciones vive en `EfficiencyTurns`.
 */
export const EfficiencyTurnCards = ({ turns }: EfficiencyTurnCardsProps) => {
  const orderedTurns = [...turns].sort((a, b) => a.index - b.index);

  if (orderedTurns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{TURN_LABEL.empty}</p>
    );
  }

  return (
    <Container space="small" className="min-w-0">
      {orderedTurns.map((turn) => (
        <TurnCard key={turn.index} turn={turn} />
      ))}
    </Container>
  );
};
