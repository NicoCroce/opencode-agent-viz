import { Container, StatusDot } from '@app/Application/Components';
import { folderName } from '@app/Application/Helpers';
import type { TGraphNode, TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import { useInspectorData } from '../Hooks/useInspectorData';
import { LoopBadge } from './LoopBadge';
import { MetricsSection } from './MetricsSection';
import { ResourceList } from './ResourceList';
import { ToolHistory } from './ToolHistory';

interface InspectorPanelProps {
  node: TGraphNode | null;
}

const STATUS_LABEL: Record<TNodeStatus, string> = {
  running: 'En curso',
  waiting: 'Esperando permiso',
  done: 'Terminado',
  error: 'Error',
  idle: 'Inactivo',
};

export const InspectorPanel = ({ node }: InspectorPanelProps) => {
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

  const { metrics } = node.data;

  return (
    <Container space="medium" className="overflow-auto p-4">
      <Container space="small">
        <span className="flex items-center gap-2">
          <StatusDot status={node.data.status} />
          <span className="font-mono text-sm font-semibold text-foreground">
            {node.data.agentName}
          </span>
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {node.data.model
            ? `${node.data.model.providerID}/${node.data.model.id}`
            : 'modelo no disponible'}
          {' · '}
          {STATUS_LABEL[node.data.status]}
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
      </Container>

      <MetricsSection metrics={metrics} />

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
