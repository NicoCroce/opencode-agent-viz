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

export const SessionList = ({
  groups,
  statuses,
  selectedId,
  onSelect,
  className,
  showCount = false,
  attentionByRoot,
}: SessionListProps) => (
  <Container space="large" className={className}>
    {groups.map((group) => {
      const count = group.items.length;
      const countLabel = `${count} ${count === 1 ? 'sesión' : 'sesiones'}`;

      return (
        <Container key={group.directory || 'sin-carpeta'} space="small">
          <div className="flex items-center gap-2 pb-1.5">
            <span aria-hidden className="font-mono text-[11px] text-signal/80">
              #
            </span>
            <span
              className="max-w-[60%] shrink-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              title={group.directory}
            >
              {folderName(group.directory)}
            </span>
            {showCount ? (
              <span
                className="shrink-0 rounded-full border border-border/60 px-1.5 font-mono text-[10px] tabular-nums leading-4 text-muted-foreground"
                aria-label={countLabel}
              >
                {count}
                <span className="sr-only"> {countLabel}</span>
              </span>
            ) : null}
            <span aria-hidden className="h-px flex-1 bg-border/50" />
          </div>
          <Container space="none" className="gap-1.5">
            <div
              className={
                showCount
                  ? 'grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3'
                  : 'flex flex-col gap-0.5'
              }
            >
              {group.items.map((item) => {
                const status = statuses?.[item.session.id];
                const isLive =
                  status?.type === 'busy' || status?.type === 'retry';

                return (
                  <SessionCard
                    key={item.session.id}
                    item={item}
                    status={status}
                    attentionCount={attentionByRoot?.[item.session.id] ?? 0}
                    layout={showCount ? 'card' : 'row'}
                    featured={showCount && isLive}
                    selected={item.session.id === selectedId}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          </Container>
        </Container>
      );
    })}
  </Container>
);
