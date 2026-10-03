import { Container } from '@app/Application/Components';
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
}

export const SessionList = ({
  groups,
  statuses,
  selectedId,
  onSelect,
  className,
}: SessionListProps) => (
  <Container space="medium" className={className}>
    {groups.map((group) => (
      <Container key={group.directory || 'sin-carpeta'} space="small">
        <span
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          title={group.directory}
        >
          <span aria-hidden className="text-accent">
            #
          </span>
          <span className="truncate">{folderName(group.directory)}</span>
        </span>
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
    ))}
  </Container>
);
