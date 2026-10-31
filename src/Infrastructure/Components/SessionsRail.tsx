import {
  GraphTruncationBanner,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import { Container } from '@app/Application/Components';
import {
  SessionList,
  SessionListSkeleton,
  useRootSessions,
  type TSessionGroup,
  type TSessionStatus,
} from '@app/Domains/Sessions';
import { countRailSessions } from '../lib/workspaceHeadline';

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
 * Rail lateral de sesiones: cabecera "Sesiones" + total en mono y el listado (o
 * su esqueleto). El fondo `--surface-1` lo pone la columna de `WorkspaceLayout`
 * para que cubra todo el alto.
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
  const sessionCount = countRailSessions(groups);
  const sessionCountLabel = `${sessionCount} ${
    sessionCount === 1 ? 'sesión' : 'sesiones'
  }`;

  return (
    <Container space="none" className="gap-3.5 px-3.5 py-[18px]">
      <Container row align="center" justify="between" space="small">
        <SectionHeading>Sesiones</SectionHeading>
        {isLoading ? null : (
          <span
            className="font-mono text-[11px] tabular-nums text-status-idle"
            title={sessionCountLabel}
          >
            <span aria-hidden>{sessionCount}</span>
            <span className="sr-only">{sessionCountLabel}</span>
          </span>
        )}
      </Container>
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
