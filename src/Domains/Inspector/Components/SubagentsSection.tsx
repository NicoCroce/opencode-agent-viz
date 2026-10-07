import { Container, StatusDot } from '@app/Application/Components';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { TTaskEntry } from '../Inspector.entity';

interface SubagentsSectionProps {
  tasks: TTaskEntry[];
  /** Otros agentes del mismo grupo de paralelismo. */
  parallelPeers: TGraphNode[];
}

/**
 * Agrupa bajo un único encabezado `Subagentes` las tareas delegadas y los
 * agentes en paralelo (FR-007/FR-008). Con ambos vacíos muestra un estado
 * vacío explícito sin desaparecer.
 */
export const SubagentsSection = ({
  tasks,
  parallelPeers,
}: SubagentsSectionProps) => (
  <Container space="small">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Subagentes
    </span>
    {tasks.length === 0 && parallelPeers.length === 0 ? (
      <p className="text-xs text-muted-foreground">
        Sin subagentes ni agentes en paralelo.
      </p>
    ) : (
      <Container space="small">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {task.status}
            </span>
            <span className="truncate text-xs text-foreground">
              {task.description}
            </span>
          </div>
        ))}
        {parallelPeers.map((peer) => (
          <div key={peer.id} className="flex min-w-0 items-center gap-2">
            <StatusDot status={peer.data.status} />
            <span className="min-w-0 truncate font-mono text-xs text-foreground">
              {peer.data.title ?? peer.data.agentName}
            </span>
          </div>
        ))}
      </Container>
    )}
  </Container>
);
