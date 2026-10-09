import { Container } from '@app/Application/Components';
import {
  SessionList,
  SessionListSkeleton,
  type TSessionGroup,
  type TSessionStatus,
} from '@app/Domains/Sessions';

interface SessionsRailProps {
  groups: TSessionGroup[];
  statuses: Record<string, TSessionStatus> | undefined;
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
}

/**
 * Rail lateral de sesiones: título "Sesiones" y el listado (o su esqueleto).
 * Los componentes de lista se importan por el **barrel** de dominio para que el
 * `vi.mock('@app/Domains/Sessions')` de los specs siga interceptándolos.
 */
export const SessionsRail = ({
  groups,
  statuses,
  selectedId,
  isLoading,
  onSelect,
}: SessionsRailProps) => (
  <Container space="small" className="p-3">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Sesiones
    </span>
    {isLoading ? (
      <SessionListSkeleton />
    ) : (
      <SessionList
        groups={groups}
        statuses={statuses}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    )}
  </Container>
);
