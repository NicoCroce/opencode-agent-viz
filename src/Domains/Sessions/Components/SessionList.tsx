import { Container } from '@app/Application/Components';
import { SectionHeading } from '@app/Application/Components/Molecules';
import { folderName } from '@app/Application/Helpers';
import type { TSessionStatus } from '../Session.entity';
import type { TSessionGroup } from '../Hooks/useRootSessions';
import { SessionCard } from './SessionCard';

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
}

export const SessionList = ({
  groups,
  statuses,
  selectedId,
  onSelect,
  className,
  showCount = false,
}: SessionListProps) => (
  <Container space="medium" className={className}>
    {groups.map((group) => {
      const count = group.items.length;
      const countLabel = `${count} ${count === 1 ? 'sesión' : 'sesiones'}`;

      return (
        <Container key={group.directory || 'sin-carpeta'} space="small">
          <SectionHeading
            className="flex items-center gap-1.5"
            title={group.directory}
          >
            <span aria-hidden className="text-accent">
              #
            </span>
            <span className="truncate">{folderName(group.directory)}</span>
            {showCount ? (
              <span
                className="shrink-0 font-mono tabular-nums text-muted-foreground"
                aria-label={countLabel}
              >
                {count}
                <span className="sr-only"> {countLabel}</span>
              </span>
            ) : null}
          </SectionHeading>
          <Container space="small">
            {group.items.map((item) => (
              <SessionCard
                key={item.session.id}
                item={item}
                status={statuses?.[item.session.id]}
                selected={item.session.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </Container>
        </Container>
      );
    })}
  </Container>
);
