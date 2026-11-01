import { Fragment, useId, useState } from 'react';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/Application/Components';
import { UnavailableValue } from '@app/Application/Components/Molecules';
import { formatCost } from '@app/Application/Helpers/formatCost';
import { formatDuration } from '@app/Application/Helpers/formatDuration';
import type { TTurnAnalysis } from '../Efficiency.entity';
import { OUTCOME_LABEL, TURN_LABEL } from '../lib/labels';
import { codePointLength, truncateCodePoints } from '../lib/text';
import { PROMPT_TRUNCATE_CODE_POINTS } from '../lib/thresholds';
import { EfficiencyTurnDetail } from './EfficiencyTurnDetail';

interface EfficiencyTurnTableProps {
  /** Turnos del informe; se ordenan por `index` antes de pintar. */
  turns: TTurnAnalysis[];
}

/** Caption propio de la tabla; el resto del copy es común (FR-007/FR-030). */
const TURN_TABLE_CAPTION = 'Turnos de la sesión';

const TURN_TABLE_COLUMNS = [
  TURN_LABEL.turn,
  TURN_LABEL.prompt,
  TURN_LABEL.clarifications,
  TURN_LABEL.outcome,
  TURN_LABEL.cost,
  TURN_LABEL.time,
  TURN_LABEL.signals,
] as const;

interface TurnRowProps {
  turn: TTurnAnalysis;
}

/**
 * Fila de la tabla con su detalle. El estado de expansión es local a la fila y
 * el prompt completo solo se monta cuando está expandida (FR-030/FR-033).
 */
const TurnRow = ({ turn }: TurnRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const isLongPrompt =
    codePointLength(turn.prompt) > PROMPT_TRUNCATE_CODE_POINTS;

  return (
    <Fragment>
      <TableRow>
        <TableHead scope="row" className="align-top font-mono">
          <span>{turn.index}</span>
          {turn.closed ? null : (
            <Badge variant="secondary" className="ml-2 align-middle">
              {TURN_LABEL.open}
            </Badge>
          )}
        </TableHead>

        <TableCell className="max-w-[32rem] whitespace-normal align-top">
          <span className="break-words">
            {truncateCodePoints(turn.prompt, PROMPT_TRUNCATE_CODE_POINTS)}
          </span>
          {isLongPrompt ? (
            <div className="mt-1">
              <Button
                variant="link"
                className="h-auto! p-0! text-xs"
                aria-expanded={expanded}
                aria-controls={expanded ? detailId : undefined}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? TURN_LABEL.collapse
                  : TURN_LABEL.expand}
              </Button>
            </div>
          ) : null}
        </TableCell>

        <TableCell className="align-top">{turn.clarifications}</TableCell>

        <TableCell className="align-top">
          {turn.outcome === null ? (
            <UnavailableValue label={TURN_LABEL.unavailableOutcome} />
          ) : (
            OUTCOME_LABEL[turn.outcome]
          )}
        </TableCell>

        <TableCell className="align-top">
          {turn.cost === null ? (
            <UnavailableValue label={TURN_LABEL.unavailableCost} />
          ) : (
            formatCost(turn.cost)
          )}
        </TableCell>

        <TableCell className="align-top">
          {turn.durationMs === null ? (
            <UnavailableValue label={TURN_LABEL.unavailableTime} />
          ) : (
            formatDuration(turn.durationMs)
          )}
        </TableCell>

        <TableCell className="align-top">
          {turn.signals.length === 0 ? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">{TURN_LABEL.noSignals}</span>
            </>
          ) : (
            <span className="font-mono text-xs">
              {turn.signals.join(', ')}
            </span>
          )}
        </TableCell>
      </TableRow>

      {expanded && isLongPrompt ? (
        <TableRow>
          <TableCell colSpan={TURN_TABLE_COLUMNS.length} className="bg-muted/30">
            <div
              id={detailId}
              role="region"
              aria-label={`Detalle del turno ${turn.index}`}
            >
              <EfficiencyTurnDetail turn={turn} />
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
};

/**
 * Tabla cronológica de turnos en escritorio (FR-032/FR-035, contrato §5.4):
 * caption accesible, columnas con `scope="col"`, filas en orden de `index` y
 * expansión bajo demanda con `aria-expanded`/`aria-controls`.
 */
export const EfficiencyTurnTable = ({ turns }: EfficiencyTurnTableProps) => {
  const orderedTurns = [...turns].sort((a, b) => a.index - b.index);

  return (
    <Table>
      <TableCaption>{TURN_TABLE_CAPTION}</TableCaption>
      <TableHeader>
        <TableRow>
          {TURN_TABLE_COLUMNS.map((column) => (
            <TableHead key={column} scope="col">
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orderedTurns.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={TURN_TABLE_COLUMNS.length}
              className="text-muted-foreground"
            >
              {TURN_LABEL.empty}
            </TableCell>
          </TableRow>
        ) : (
          orderedTurns.map((turn) => <TurnRow key={turn.index} turn={turn} />)
        )}
      </TableBody>
    </Table>
  );
};
