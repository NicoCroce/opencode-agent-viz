import { useState } from 'react';
import { Container } from '@app/Application/Components';
import { SectionFrame } from '@app/Application/Components/Molecules';
import type { TFileChange } from '../Inspector.entity';

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

const STATUS_COLOR: Record<TFileChange['status'], string> = {
  added: 'text-status-done',
  modified: 'text-status-running',
  deleted: 'text-status-error',
};

/**
 * Impacto del agente en el repositorio (FR-028..FR-030): lista de archivos con
 * su estado y líneas añadidas/quitadas. Seleccionar un archivo muestra su
 * parche en monoespaciado; un parche vacío/ausente no bloquea la vista y se
 * indica como "parche no disponible". Sin cambios → estado vacío explícito.
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
          {changes.map((change) => (
            <button
              key={change.file}
              type="button"
              aria-pressed={change.file === selectedFile}
              onClick={() =>
                setSelectedFile((current) =>
                  current === change.file ? null : change.file,
                )
              }
              className="flex w-full min-w-0 items-center justify-between gap-2 border-b border-border py-1 text-left last:border-b-0"
            >
              <span className="min-w-0 truncate font-mono text-xs text-foreground">
                {change.file}
              </span>
              <span
                className={`shrink-0 font-mono text-[11px] ${STATUS_COLOR[change.status] ?? 'text-muted-foreground'}`}
              >
                {STATUS_LABEL[change.status] ?? change.status}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-status-done">
                +{change.additions}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-status-error">
                -{change.deletions}
              </span>
            </button>
          ))}
        </Container>

        {selected ? (
          selected.patch.trim().length === 0 ? (
            <p className="text-xs text-muted-foreground">
              parche no disponible
            </p>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-flat border border-border bg-surface-1 p-2 font-mono text-[11px] text-foreground">
              {selected.patch}
            </pre>
          )
        ) : null}
      </Container>
    </SectionFrame>
  );
};
