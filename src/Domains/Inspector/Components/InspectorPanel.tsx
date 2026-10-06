import { Container, StatusDot } from '@app/Application/Components';
import { folderName } from '@app/Application/Helpers';
import { UNAVAILABLE } from '@app/Application/Helpers/formatDuration';
import type { TGraphNode, TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import { useInspectorData } from '../Hooks/useInspectorData';
import { LoopBadge } from './LoopBadge';
import { MetricsSection } from './MetricsSection';
import { ResourceList } from './ResourceList';
import { ToolHistory } from './ToolHistory';

interface InspectorPanelProps {
  node: TGraphNode | null;
  /** Otros agentes del mismo grupo de paralelismo que `node`. */
  parallelPeers?: TGraphNode[];
  /** Nodo que invocó a `node` (relación padre → hijo), si lo hay. */
  invokedBy?: TGraphNode | null;
}

const STATUS_LABEL: Record<TNodeStatus, string> = {
  running: 'En curso',
  waiting: 'Esperando permiso',
  done: 'Terminado',
  error: 'Error',
  idle: 'Inactivo',
};

/** Fila etiqueta/valor: etiqueta a la izquierda, dato monoespaciado a la derecha. */
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 items-baseline justify-between gap-3">
    <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
    <span className="min-w-0 break-all text-right font-mono text-[11px] text-foreground">
      {value}
    </span>
  </div>
);

export const InspectorPanel = ({
  node,
  parallelPeers = [],
  invokedBy = null,
}: InspectorPanelProps) => {
  const { tools, errors, tasks, resources } = useInspectorData(node);

  if (!node) {
    return (
      <Container space="small" className="p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Inspector
        </span>
        <p className="text-xs text-muted-foreground">
          Selecciona un nodo del grafo para ver su detalle.
        </p>
      </Container>
    );
  }

  const { metrics, model } = node.data;

  return (
    <Container space="medium" className="overflow-auto p-4">
      {/* Identidad: título completo (sin cortar) + agente + estado + directorio */}
      <Container space="small">
        <span className="text-sm font-semibold leading-snug text-foreground">
          {node.data.title ?? node.data.agentName}
        </span>
        <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <StatusDot status={node.data.status} />
          <span className="text-foreground">{node.data.agentName}</span>
          <span aria-hidden>·</span>
          <span>{STATUS_LABEL[node.data.status]}</span>
        </span>
        <span
          className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"
          title={node.data.directory}
        >
          <span aria-hidden className="text-accent">
            #
          </span>
          <span className="truncate">{folderName(node.data.directory)}</span>
        </span>
        {invokedBy ? (
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
            Invocado por{' '}
            <span className="text-foreground">
              {invokedBy.data.title ?? invokedBy.data.agentName}
            </span>
          </span>
        ) : null}
      </Container>

      {/* Modelo: nombre y razonamiento (variante del modelo) */}
      <Container space="small">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Modelo
        </span>
        <Container space="small">
          <DetailRow
            label="Nombre"
            value={model ? `${model.providerID}/${model.id}` : UNAVAILABLE}
          />
          <DetailRow label="Razonamiento" value={model?.variant ?? UNAVAILABLE} />
        </Container>
      </Container>

      <MetricsSection metrics={metrics} />

      {parallelPeers.length > 0 ? (
        <Container space="small">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            En paralelo ({parallelPeers.length + 1})
          </span>
          <Container space="small">
            {parallelPeers.map((peer) => (
              <div key={peer.id} className="flex min-w-0 items-center gap-2">
                <StatusDot status={peer.data.status} />
                <span className="min-w-0 truncate font-mono text-xs text-foreground">
                  {peer.data.title ?? peer.data.agentName}
                </span>
              </div>
            ))}
          </Container>
        </Container>
      ) : null}

      {metrics.hasLoop ? (
        <LoopBadge
          retryCount={metrics.retryCount}
          evidence={metrics.loopEvidence}
        />
      ) : null}

      <ResourceList resources={resources} />

      <ToolHistory tools={tools} />

      <Container space="small">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tareas del subagente
        </span>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin tareas de subagente.
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
          </Container>
        )}
      </Container>

      <Container space="small">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Errores
        </span>
        {errors.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin errores.</p>
        ) : (
          <Container space="small">
            {errors.map((error, index) => (
              <p key={index} className="text-xs text-status-error">
                {error.message}
              </p>
            ))}
          </Container>
        )}
      </Container>
    </Container>
  );
};
