import { Container } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import type {
  TNodeEffort,
  TNodeParallelism,
  TNodeStatus,
} from '../Graph.entity';
import { EffortMeter } from './EffortMeter';

interface AgentNodeHeaderProps {
  /** Título de la tarea; si falta, se muestra el nombre del agente. */
  title: string | null;
  agentName: string;
  /** Paralelismo del nodo; `null` cuando corrió solo. */
  parallel: TNodeParallelism | null;
  /** Nivel de esfuerzo de vista; `null`/`undefined` → no se muestra el medidor. */
  effort: TNodeEffort | null | undefined;
  isRunning: boolean;
  status: TNodeStatus;
}

/**
 * Encabezado del card: tarea (máx. 2 líneas) + medidor de esfuerzo (FR-026) +
 * badge de paralelismo + etiqueta de estado. El medidor va en la **misma fila**
 * que el badge de paralelos para no añadir filas ni alterar `cardHeight`
 * (effort-contract §5; design-direction §3.6). El `title` del badge de paralelo
 * es contrato del spec (`N agentes ejecutados en paralelo`). La señal principal
 * de actividad es el barrido del rail (`NodeStatusRail`, FR-001); el encabezado
 * ya no muestra el pulso `animate-pulse` (active-node-feedback-contract §1).
 */
export const AgentNodeHeader = ({
  title,
  agentName,
  parallel,
  effort,
  status,
}: AgentNodeHeaderProps) => (
  <Container row align="start" justify="between" space="small" className="min-w-0">
    <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-snug text-foreground">
      {title ?? agentName}
    </span>
    <span className="flex shrink-0 items-center gap-1">
      <EffortMeter effort={effort} />
      {parallel ? (
        <span
          className="rounded-flat border border-foreground/40 px-1 font-mono text-[10px] leading-4 text-foreground"
          title={`${parallel.size} agentes ejecutados en paralelo`}
        >
          {`∥${parallel.size}`}
        </span>
      ) : null}
      <span className="text-[11px] text-muted-foreground">
        {NODE_STATUS_LABEL[status]}
      </span>
    </span>
  </Container>
);
