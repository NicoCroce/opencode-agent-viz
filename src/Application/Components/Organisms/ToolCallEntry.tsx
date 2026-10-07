import { useState, type ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';
import { formatDuration, UNAVAILABLE } from '@app/Application/Helpers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import type { TToolEntry, TToolStatus } from '@app/Domains/History/History.entity';

interface ToolCallEntryProps {
  /** Llamada a herramienta proyectada por `buildHistory` (`TToolEntry`). */
  entry: TToolEntry;
}

/** Etiqueta del estado real de la llamada; nunca inventa un resultado (FR-004). */
const STATUS_LABEL: Record<TToolStatus, string> = {
  streaming: 'En curso',
  running: 'Ejecutando',
  completed: 'Completada',
  error: 'Fallida',
};

/** Color semántico del estado (reutiliza tokens de la feature 001). */
const STATUS_COLOR: Record<TToolStatus, string> = {
  streaming: 'text-status-running',
  running: 'text-status-running',
  completed: 'text-status-done',
  error: 'text-status-error',
};

/** Serializa la entrada cruda de la herramienta para mostrarla (FR-004). */
const formatInput = (input: unknown): string => {
  if (input === null || input === undefined) return UNAVAILABLE;
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2) ?? UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
};

/** Campo etiqueta/valor del detalle expandido. */
const ToolField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

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
    <div className="flex flex-col">
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
        <span
          className={cn('shrink-0 font-mono text-[11px]', STATUS_COLOR[entry.status])}
        >
          {STATUS_LABEL[entry.status]}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(entry.durationMs)}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2 border-l border-border py-1 pl-4">
          <ToolField label="Entrada">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-flat border border-border bg-surface-0 p-2 font-mono text-[11px] leading-5 text-foreground">
              {formatInput(entry.input)}
            </pre>
          </ToolField>

          {hasError ? (
            <ToolField label="Error">
              <p className="whitespace-pre-wrap break-all text-xs text-status-error">
                {entry.error}
              </p>
            </ToolField>
          ) : null}

          {hasResult ? (
            <ToolField label="Resultado">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-flat border border-border bg-surface-0 p-2 font-mono text-[11px] leading-5 text-foreground">
                {entry.result}
              </pre>
            </ToolField>
          ) : null}

          {!hasResult && !hasError ? (
            <p className="text-xs text-muted-foreground">Sin resultado todavía.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
