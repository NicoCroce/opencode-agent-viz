import { GraphTruncationBanner } from '@app/Application/Components/Molecules';
import { Container } from '@app/Application/Components';
import {
  SessionList,
  SessionListSkeleton,
  useRootSessions,
  type TSessionGroup,
  type TSessionStatus,
} from '@app/Domains/Sessions';

interface SessionsRailProps {
  groups: TSessionGroup[];
  statuses: Record<string, TSessionStatus> | undefined;
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  /**
   * Corte del listado de raíces (R5). Opcional: si el contenedor no lo inyecta,
   * el riel lee el agregado de `useRootSessions` (misma caché por
   * `queryKeys.sessions.roots`), de modo que el aviso se vea también aquí sin
   * que el listado lateral dependa de que se lo pasen.
   */
  truncated?: boolean;
  /**
   * Pendientes por sesión raíz (FR-009/US5), calculados en `WorkspacePage` y
   * reenviados tal cual al listado. Presentación pura.
   */
  attentionByRoot?: Record<string, number>;
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
  truncated,
  attentionByRoot,
}: SessionsRailProps) => {
  // Sin prop, el corte se lee del mismo resultado que alimenta el listado: la
  // clave de caché es la misma, así que no añade ninguna request.
  const { truncated: aggregatedTruncation } = useRootSessions();
  const isTruncated = truncated ?? aggregatedTruncation ?? false;

  return (
    <Container space="small" className="p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sesiones
      </span>
      {isTruncated ? <GraphTruncationBanner /> : null}
      {isLoading ? (
        <SessionListSkeleton />
      ) : (
        <SessionList
          groups={groups}
          statuses={statuses}
          selectedId={selectedId}
          onSelect={onSelect}
          attentionByRoot={attentionByRoot}
        />
      )}
    </Container>
  );
};
