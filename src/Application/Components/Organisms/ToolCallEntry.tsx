import { useState } from 'react';
import { formatDuration } from '@app/Application/Helpers';
import { formatToolInput } from '@app/Application/Helpers/formatToolInput';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { Container } from '@app/Application/Components';
import { LabeledField, ToolStatusBadge } from '@app/Application/Components/Molecules';
import type { TToolEntry } from '@app/Domains/History/History.entity';

interface ToolCallEntryProps {
  /** Llamada a herramienta proyectada por `buildHistory` (`TToolEntry`). */
  entry: TToolEntry;
}

/**
 * Fila expandible/contraíble de una llamada a herramienta (FR-004/011).
 *
 * El control de expandir es una fila plana con chevron, sin caja. Al expandir
 * muestra la entrada y, solo si existen, el resultado y el error. Mientras la
 * herramienta no haya terminado indica que no hay resultado todavía en lugar de
 * fabricar uno (edge case de la spec).
 */
export const ToolCallEntry = ({ entry }: ToolCallEntryProps) => {
  const [expanded, setExpanded] = useState(false);

  const hasResult = entry.result !== null;
  const hasError = entry.error !== null;

  return (
    <Container space="none">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 py-1 text-left text-foreground transition-colors hover:text-accent"
      >
        <FontAwesomeIcon
          icon={expanded ? faChevronDown : faChevronRight}
          className="shrink-0 text-[10px] text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 truncate font-mono text-xs">{entry.name}</span>
        <ToolStatusBadge status={entry.status} />
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(entry.durationMs)}
        </span>
      </button>

      {expanded ? (
        <Container
          space="small"
          className="border-l border-border py-1 pl-4"
        >
          <LabeledField label="Entrada">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-flat border border-border bg-surface-0 p-2 font-mono text-[11px] leading-5 text-foreground">
              {formatToolInput(entry.input)}
            </pre>
          </LabeledField>

          {hasError ? (
            <LabeledField label="Error">
              <p className="whitespace-pre-wrap break-all text-xs text-status-error">
                {entry.error}
              </p>
            </LabeledField>
          ) : null}

          {hasResult ? (
            <LabeledField label="Resultado">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-flat border border-border bg-surface-0 p-2 font-mono text-[11px] leading-5 text-foreground">
                {entry.result}
              </pre>
            </LabeledField>
          ) : null}

          {!hasResult && !hasError ? (
            <p className="text-xs text-muted-foreground">Sin resultado todavía.</p>
          ) : null}
        </Container>
      ) : null}
    </Container>
  );
};
