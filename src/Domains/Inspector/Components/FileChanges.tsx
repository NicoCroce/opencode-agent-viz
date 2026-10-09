import { useState } from 'react';
import { Container } from '@app/Application/Components';
import { SectionFrame } from '@app/Application/Components/Molecules';
import { cn } from '@app/Application/lib/utils';
import type { TFileChange } from '../Inspector.entity';
import { FileDiff } from './FileDiff';

interface FileChangesProps {
  /** Archivos afectados por el agente (FR-028). */
  changes: TFileChange[];
  /** La consulta de diff falló (Principio VI). */
  isError: boolean;
  /** La consulta de diff está en curso (Principio VI). */
  isLoading: boolean;
}

/** Estado del cambio en lenguaje natural (FR-028). */
const STATUS_LABEL: Record<TFileChange['status'], string> = {
  added: 'añadido',
  modified: 'modificado',
  deleted: 'borrado',
};

/** Punto LED por estado del archivo, reutilizando el lenguaje de LEDs (FR-019). */
const STATUS_DOT_COLOR: Record<TFileChange['status'], string> = {
  added: 'bg-status-done',
  modified: 'bg-status-running',
  deleted: 'bg-status-error',
};

/**
 * Ancho de las columnas numéricas del pie de fila. Fijas y alineadas a la
 * derecha (`tabular-nums`) para que estados y deltas formen una tabla que se lee
 * en vertical, no una fila que se desalinea con cada ruta.
 */
const STATUS_COL = 'w-[70px]';
const DELTA_COL = 'w-9';

/**
 * Impacto del agente en el repositorio (FR-028..FR-030): lista de archivos como
 * **tabla alineada** — LED + ruta (que trunca) + estado + líneas añadidas/quitadas
 * en columnas fijas. La fila es un botón con hover y estado seleccionado; al
 * seleccionar un archivo se muestra su parche con el diff estilo editor
 * (`FileDiff`, FR-016..FR-018). Un parche vacío/ausente no bloquea la vista y se
 * indica como "parche no disponible". Sin cambios → estado vacío explícito.
 *
 * El color del estado vive en el LED; la etiqueta va neutra para no duplicar la
 * señal. Los deltas en cero se atenúan (una fila solo-añade no grita `-0`).
 *
 * Presentación pura: recibe `changes`/`isError`/`isLoading` desde el hook
 * (`useSessionDiff`) y solo gestiona la selección local del archivo.
 */
export const FileChanges = ({
  changes,
  isError,
  isLoading,
}: FileChangesProps) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const selected =
    changes.find((change) => change.file === selectedFile) ?? null;

  return (
    <SectionFrame
      title="Archivos"
      isError={isError}
      isLoading={isLoading}
      isEmpty={changes.length === 0}
      emptyLabel="Sin cambios de archivos"
    >
      <Container space="small">
        <Container space="none">
          {changes.map((change) => {
            const isSelected = change.file === selectedFile;
            return (
              <button
                key={change.file}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedFile((current) =>
                    current === change.file ? null : change.file,
                  )
                }
                className={cn(
                  'flex w-full min-w-0 items-center gap-1.5 border-b border-border px-1 py-1 text-left transition-colors last:border-b-0',
                  'hover:bg-surface-2',
                  isSelected && 'bg-surface-2',
                )}
              >
                <span
                  data-dot={change.status}
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    STATUS_DOT_COLOR[change.status],
                  )}
                />
                <span
                  className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
                  title={change.file}
                >
                  {change.file}
                </span>
                <span
                  className={cn(
                    STATUS_COL,
                    'shrink-0 text-right font-mono text-[11px] text-muted-foreground',
                  )}
                >
                  {STATUS_LABEL[change.status] ?? change.status}
                </span>
                <span
                  className={cn(
                    DELTA_COL,
                    'shrink-0 text-right font-mono text-[11px] tabular-nums',
                    change.additions > 0
                      ? 'text-status-done'
                      : 'text-muted-foreground/60',
                  )}
                >
                  +{change.additions}
                </span>
                <span
                  className={cn(
                    DELTA_COL,
                    'shrink-0 text-right font-mono text-[11px] tabular-nums',
                    change.deletions > 0
                      ? 'text-status-error'
                      : 'text-muted-foreground/60',
                  )}
                >
                  -{change.deletions}
                </span>
              </button>
            );
          })}
        </Container>

        {selected ? (
          selected.patch.trim().length === 0 ? (
            <p className="text-xs text-muted-foreground">
              parche no disponible
            </p>
          ) : (
            <FileDiff patch={selected.patch} />
          )
        ) : null}
      </Container>
    </SectionFrame>
  );
};
