import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { Container } from '@app/Application/Components';
import { cn } from '@app/Application/lib/utils';
import type { TDiffLine, TDiffLineKind } from '../Inspector.entity';
import { parseUnifiedDiff } from '../lib/parseDiff';

interface FileDiffProps {
  /** Parche unificado del archivo (`TFileChange.patch`). */
  patch: string;
}

/**
 * Fondo + borde izquierdo por tipo de línea (tokens, design-direction §3.5):
 * añadida = `--status-done` a ~14 % de alfa; eliminada = `--status-error` a
 * ~14 %; contexto/meta = sin fondo. Nunca hex suelto.
 */
const LINE_CLASS: Record<TDiffLineKind, string> = {
  added: 'bg-status-done/14 border-l-2 border-l-status-done',
  removed: 'bg-status-error/14 border-l-2 border-l-status-error',
  context: 'border-l-2 border-l-transparent',
  meta: 'border-l-2 border-l-transparent',
};

/** Canal de números viejo/nuevo en mono tabular (FR-018). */
const NUMBER_CLASS =
  'w-10 shrink-0 select-none pr-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground';

const CONTENT_CLASS =
  'min-w-0 whitespace-pre font-mono text-[11px] leading-5 text-foreground';

/**
 * Una línea del diff: canal doble de números (viejo/nuevo) + contenido. El
 * `data-kind` expone el tipo de vista para el spec y para estilos condicionales.
 */
const DiffLine = ({ line }: { line: TDiffLine }) => (
  <Container
    row
    space="none"
    data-kind={line.kind}
    className={cn('px-2', LINE_CLASS[line.kind])}
  >
    <span data-number="old" className={NUMBER_CLASS} aria-hidden>
      {line.oldNumber ?? ''}
    </span>
    <span data-number="new" className={NUMBER_CLASS} aria-hidden>
      {line.newNumber ?? ''}
    </span>
    <span
      className={cn(
        CONTENT_CLASS,
        line.kind === 'meta' && 'italic text-muted-foreground',
      )}
    >
      {line.content}
    </span>
  </Container>
);

/**
 * Diff estilo editor (FR-016..FR-018, file-diff-contract §3/§4).
 *
 * Renderiza el parche unificado ya parseado por `parseUnifiedDiff` (memoizado
 * por `patch`, SC-004): fondo/borde por línea con tokens, canal doble de
 * números en mono tabular y encabezados de hunk en `--surface-2` con chevron.
 * Cada hunk arranca **expandido** y se colapsa con estado local (set por hunk),
 * sin persistencia; el encabezado es un `<button>` con `aria-expanded`,
 * operable por teclado (SC-007). Presentación pura: no llama servicios.
 */
export const FileDiff = ({ patch }: FileDiffProps) => {
  const hunks = useMemo(() => parseUnifiedDiff(patch), [patch]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const toggle = (index: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (hunks.length === 0) return null;

  return (
    <Container
      space="none"
      className="overflow-hidden rounded-flat border border-border"
    >
      {hunks.map((hunk, index) => {
        const isExpanded = !collapsed.has(index);

        return (
          <Container key={`${hunk.header}-${index}`} space="none">
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => toggle(index)}
              className="flex w-full items-center gap-2 bg-surface-2 px-2 py-1 text-left transition-colors hover:text-accent"
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                className="shrink-0 text-[10px] text-muted-foreground"
                aria-hidden
              />
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {hunk.header}
              </span>
            </button>

            {isExpanded ? (
              <Container space="none" className="overflow-x-auto">
                {hunk.lines.map((line, lineIndex) => (
                  <DiffLine key={lineIndex} line={line} />
                ))}
              </Container>
            ) : null}
          </Container>
        );
      })}
    </Container>
  );
};
