import { Container, StatusDot } from '@app/Application/Components';
import { SectionFrame } from '@app/Application/Components/Molecules';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { TTaskEntry } from '../Inspector.entity';

interface SubagentsSectionProps {
  tasks: TTaskEntry[];
  /** Otros agentes del mismo grupo de paralelismo. */
  parallelPeers: TGraphNode[];
  /** La consulta de la sección falló (Principio VI). */
  isError?: boolean;
  /** La consulta de la sección está en curso (Principio VI). */
  isLoading?: boolean;
}

/**
 * Agrupa bajo un único encabezado `Subagentes` las tareas delegadas y los
 * agentes en paralelo (FR-007/FR-008). Resuelve los estados de pantalla en
 * orden **error → carga → vacío → datos** (Principio VI) y, con ambos vacíos,
 * muestra un estado vacío explícito sin desaparecer.
 */
export const SubagentsSection = ({
  tasks,
  parallelPeers,
  isError = false,
  isLoading = false,
}: SubagentsSectionProps) => (
  <SectionFrame
    title="Subagentes"
    isError={isError}
    isLoading={isLoading}
    isEmpty={tasks.length === 0 && parallelPeers.length === 0}
    emptyLabel="Sin subagentes ni agentes en paralelo."
  >
    <Container space="small">
      {tasks.map((task) => (
        <Container key={task.id} row space="small" align="center">
          <span className="font-mono text-[11px] text-muted-foreground">
            {task.status}
          </span>
          <span className="truncate text-xs text-foreground">
            {task.description}
          </span>
        </Container>
      ))}
      {parallelPeers.map((peer) => (
        <Container
          key={peer.id}
          row
          space="small"
          align="center"
          className="min-w-0"
        >
          <StatusDot status={peer.data.status} />
          <span className="min-w-0 truncate font-mono text-xs text-foreground">
            {peer.data.title ?? peer.data.agentName}
          </span>
        </Container>
      ))}
    </Container>
  </SectionFrame>
);
