import { Container } from '@app/Application/Components';
import { folderName } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TSessionStatus } from '../Session.entity';
import type { TSessionGroup } from '../Hooks/useRootSessions';
import { SessionGroupHeading } from './SessionGroupHeading';
import { SessionTableRow } from './SessionTableRow';

interface SessionTableProps {
  groups: TSessionGroup[];
  statuses?: Record<string, TSessionStatus>;
  onSelect: (id: string) => void;
  /** Muestra el conteo de sesiones en el encabezado de cada grupo (FR-016). */
  showCount?: boolean;
  className?: string;
}

/** Columnas de la tabla; `numeric` alinea a la derecha (cifras y horas). */
const COLUMNS = [
  { key: 'session', label: 'Sesión', numeric: false },
  { key: 'status', label: 'Estado', numeric: false },
  { key: 'cost', label: 'Costo', numeric: true },
  { key: 'duration', label: 'Duración', numeric: true },
  { key: 'range', label: 'Intervalo', numeric: true },
] as const;

/**
 * Listado de sesiones en tabla (presentación de escritorio de la página).
 *
 * Un bloque por proyecto: encabezado `# carpeta` + tabla en un contenedor
 * `rounded-xl` con scroll horizontal propio (la página nunca desborda). Mismo
 * contrato que `SessionList`: recibe los grupos ya filtrados y delega la
 * selección en `onSelect` (presentación pura).
 */
export const SessionTable = ({
  groups,
  statuses,
  onSelect,
  showCount = false,
  className,
}: SessionTableProps) => (
  <Container space="large" className={className}>
    {groups.map((group) => (
      <Container key={group.directory || 'sin-carpeta'} space="small">
        <SessionGroupHeading
          directory={group.directory}
          count={group.items.length}
          showCount={showCount}
        />
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-1">
          <table
            aria-label={folderName(group.directory)}
            className="w-full min-w-[720px] border-collapse text-left"
          >
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-[18px] py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-status-idle',
                      column.numeric && 'text-right',
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <SessionTableRow
                  key={item.session.id}
                  item={item}
                  status={statuses?.[item.session.id]}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    ))}
  </Container>
);
