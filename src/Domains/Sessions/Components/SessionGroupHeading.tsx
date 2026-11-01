import { SectionHeading } from '@app/Application/Components/Molecules';
import { folderName } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';

interface SessionGroupHeadingProps {
  /** Directorio del grupo; su carpeta es el texto y la ruta, el tooltip. */
  directory: string;
  /** Nº de sesiones mostradas en el grupo (FR-016). */
  count: number;
  /** Muestra el conteo (opt-in, solo la página del listado, FR-018). */
  showCount?: boolean;
  className?: string;
}

/**
 * Encabezado de grupo por proyecto, compartido por el listado de tarjetas y la
 * tabla de la página: `# carpeta` en versalitas mono y, opcionalmente, el
 * conteo con nombre accesible textual (`N sesiones`).
 */
export const SessionGroupHeading = ({
  directory,
  count,
  showCount = false,
  className,
}: SessionGroupHeadingProps) => {
  const countLabel = `${count} ${count === 1 ? 'sesión' : 'sesiones'}`;

  return (
    <SectionHeading
      className={cn('flex items-center gap-1.5', className)}
      title={directory}
    >
      <span aria-hidden className="text-accent">
        #
      </span>
      <span className="truncate">{folderName(directory)}</span>
      {showCount ? (
        <span
          className="ml-auto shrink-0 font-mono tabular-nums text-status-idle"
          aria-label={countLabel}
        >
          {count}
          <span className="sr-only"> {countLabel}</span>
        </span>
      ) : null}
    </SectionHeading>
  );
};
