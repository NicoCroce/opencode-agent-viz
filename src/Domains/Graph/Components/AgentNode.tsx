import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Container } from '@app/Application/Components';
import { cn } from '@app/Application/lib/utils';
import type { TGraphNodeData } from '../Graph.entity';
import { isActiveStatus } from '../lib/nodeStatus';
import { AgentNodeFooter } from './AgentNodeFooter';
import { AgentNodeEffortBand } from './AgentNodeEffortBand';
import { AgentNodeHeader } from './AgentNodeHeader';
import { AgentNodeModelLine } from './AgentNodeModelLine';
import { NodeResizeHandles } from './NodeResizeHandles';
import { NodeStatusRail } from './NodeStatusRail';
import { useNodeFocusOpacity } from './useNodeFocusOpacity';

type AgentFlowNode = Node<TGraphNodeData, 'agent'>;

/**
 * Card del agente: encabezado (título + cluster de estado), línea de modelo,
 * pie con consumo/contexto y banda de esfuerzo al pie (la firma del nodo). El
 * alto lo calcula `cardHeight` (`lib/cardHeight.ts`) y lo comparten los carriles
 * de ejecución.
 */
const AgentNodeComponent = ({ id, data, selected }: NodeProps<AgentFlowNode>) => {
  // Resaltado de foco por contexto (contrato de render §1.2/§2).
  const focusOpacity = useNodeFocusOpacity(id);

  // Activo mientras corre, reintenta, compacta o espera permiso/respuesta
  // (FR-015/FR-017); un estado terminal ya no está activo.
  const isRunning = isActiveStatus(data.status);
  const parallel = data.parallel && data.parallel.size > 1 ? data.parallel : null;

  return (
    <div
      style={focusOpacity === undefined ? undefined : { opacity: focusOpacity }}
      className={cn(
        'group relative h-full w-full min-w-0 rounded-flat border bg-surface-2',
        selected ? 'border-accent' : 'border-border',
        // Color de tiradores: `--border` en reposo y `--accent` en hover/selected.
        selected
          ? '[--xy-resize-background-color:hsl(var(--accent))]'
          : '[--xy-resize-background-color:hsl(var(--border))] group-hover:[--xy-resize-background-color:hsl(var(--accent))]',
      )}
    >
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
          isRunning={isRunning}
          status={data.status}
        />
        <AgentNodeModelLine model={data.model} />
        <AgentNodeFooter
          metrics={data.metrics}
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
