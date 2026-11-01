import { Container } from '@app/Application/Components';
import type { TSessionStatus } from '../Session.entity';
import type { TSessionGroup } from '../Hooks/useRootSessions';
import { SessionCard } from './SessionCard';
import { SessionGroupHeading } from './SessionGroupHeading';

interface SessionListProps {
  groups: TSessionGroup[];
  statuses?: Record<string, TSessionStatus>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  /**
   * Muestra el conteo de sesiones en el encabezado de cada grupo (FR-016).
   * Opt-in: solo la página del listado lo activa, de modo que el listado
   * lateral del espacio de trabajo permanezca sin cambios (FR-018).
   */
  showCount?: boolean;
  /**
   * Pendientes por sesión raíz (`sessionID` → nº de `TAttentionItem` de su
   * subárbol, FR-009/US5). Presentación pura: cada `SessionCard` recibe su
   * conteo; una raíz ausente del mapa no muestra badge.
   */
  attentionByRoot?: Record<string, number>;
}

/**
 * Listado de sesiones en tarjetas: rail del espacio de trabajo y presentación
 * móvil de la página. Agrupa por proyecto con `SessionGroupHeading`.
 */
export const SessionList = ({
  groups,
  statuses,
  selectedId,
  onSelect,
  className,
  showCount = false,
  attentionByRoot,
}: SessionListProps) => (
  <Container space="medium" className={className}>
    {groups.map((group) => (
      <Container key={group.directory || 'sin-carpeta'} space="small">
        <SessionGroupHeading
          directory={group.directory}
          count={group.items.length}
          showCount={showCount}
          className="px-1 pt-1"
        />
        <Container space="small">
          {group.items.map((item) => (
            <SessionCard
              key={item.session.id}
              item={item}
              status={statuses?.[item.session.id]}
              attentionCount={attentionByRoot?.[item.session.id] ?? 0}
              selected={item.session.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </Container>
      </Container>
    ))}
  </Container>
);
