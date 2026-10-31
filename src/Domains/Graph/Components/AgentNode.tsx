import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Container } from '@app/Application/Components';
import { cn } from '@app/Application/lib/utils';
import type { TGraphNodeData } from '../Graph.entity';
import { hasContextFlow } from '../lib/cardHeight';
import { isActiveStatus } from '../lib/nodeStatus';
import { AgentNodeFooter } from './AgentNodeFooter';
import { AgentNodeEffortBand } from './AgentNodeEffortBand';
import { AgentNodeHeader } from './AgentNodeHeader';
import { AgentNodeModelLine } from './AgentNodeModelLine';
import { NodeResizeHandles } from './NodeResizeHandles';
import { NodeStatusRail } from './NodeStatusRail';
import { useNodeAttention } from './NodeFocusContext';
import { useNodeFocusOpacity } from './useNodeFocusOpacity';

type AgentFlowNode = Node<TGraphNodeData, 'agent'>;

/**
 * Card del agente: encabezado (título + cluster de estado), línea de modelo,
 * pie con consumo/contexto y banda de esfuerzo al pie (la firma del nodo). El
 * alto lo calcula `cardHeight` (`lib/cardHeight.ts`) y lo comparten los carriles
 * de ejecución.
 */
const AgentNodeComponent = ({
  id,
  data,
  selected,
}: NodeProps<AgentFlowNode>) => {
  // Resaltado de foco por contexto (contrato de render §1.2/§2).
  const focusOpacity = useNodeFocusOpacity(id);
  // Realce de atención: solo el nodo afectado, leído del contexto (FR-009/A6).
  const hasAttention = useNodeAttention(id);

  // Activo mientras corre, reintenta, compacta o espera permiso/respuesta
  // (FR-015/FR-017); un estado terminal ya no está activo.
  const isRunning = isActiveStatus(data.status);
  const parallel =
    data.parallel && data.parallel.size > 1 ? data.parallel : null;

  return (
    <div
      style={focusOpacity === undefined ? undefined : { opacity: focusOpacity }}
      className={cn(
        'group relative h-full w-full min-w-0 rounded-flat border bg-surface-2 transition-[border-color,box-shadow,background-color] duration-200',
        'shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]',
        // El pendiente gana el borde (no-color: trazo discontinuo + etiqueta
        // textual), luego la selección, luego el borde en reposo.
        hasAttention
          ? 'border-dashed border-status-waiting'
          : selected
            ? 'border-signal shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05),0_0_0_1px_hsl(var(--signal)/0.28),0_18px_44px_-26px_hsl(var(--signal)/0.55)]'
            : 'border-border/80 hover:border-border',
        // Color de tiradores: `--border` en reposo y `--signal` en hover/selected.
        selected
          ? '[--xy-resize-background-color:hsl(var(--signal))]'
          : '[--xy-resize-background-color:hsl(var(--border))] group-hover:[--xy-resize-background-color:hsl(var(--signal))]',
      )}
    >
      {hasAttention ? (
        <span
          role="img"
          aria-label="Pendiente de respuesta"
          data-testid="node-attention"
          title="Pendiente de respuesta"
          className="absolute -right-1 -top-1 z-10 rounded-flat border border-status-waiting bg-surface-1 px-1 py-0.5 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.08em] text-status-waiting"
        >
          Pendiente
        </span>
      ) : null}
      <NodeResizeHandles nodeId={id} selected={selected} />
      <NodeStatusRail
        status={data.status}
        active={isRunning}
        hasLoop={data.metrics.hasLoop}
      />
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <Container
        space="none"
        className="h-full w-full min-w-0 overflow-hidden py-2.5 pl-3 pr-2.5"
      >
        <AgentNodeHeader
          title={data.title}
          agentName={data.agentName}
          parallel={parallel}
          speedup={data.speedup ?? null}
          latency={data.context?.latency ?? null}
          isRunning={isRunning}
          status={data.status}
        />
        <AgentNodeModelLine model={data.model} />
        <AgentNodeFooter
          metrics={data.metrics}
          contextWindow={data.context?.window ?? null}
          hasContextFlow={hasContextFlow(data)}
          isRunning={isRunning}
          status={data.status}
          currentTool={data.currentTool}
          retry={data.retry}
          interruptReason={data.interruptReason}
        />
        <AgentNodeEffortBand effort={data.effort} />
      </Container>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
};

export const AgentNode = memo(AgentNodeComponent);
