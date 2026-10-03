import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@app/Application/lib/utils';
import { formatCost, formatDuration, formatTokens } from '@app/Application/Helpers';
import type { TGraphNodeData, TNodeStatus, TTokenUsage } from '../Graph.entity';
import { NodeStatusRail } from './NodeStatusRail';

type AgentFlowNode = Node<TGraphNodeData, 'agent'>;

const STATUS_LABEL: Record<TNodeStatus, string> = {
  running: 'En curso',
  waiting: 'Esperando',
  done: 'Terminado',
  error: 'Error',
  idle: 'Inactivo',
};

const totalTokens = (tokens: TTokenUsage | null): number | null => {
  if (!tokens) return null;
  const values = [tokens.input, tokens.output, tokens.reasoning].filter(
    (v): v is number => v !== null,
  );
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
};

const AgentNodeComponent = ({ data, selected }: NodeProps<AgentFlowNode>) => {
  const { metrics } = data;

  return (
    <div
      className={cn(
        'relative w-[220px] rounded-flat border bg-surface-2 py-2 pl-3 pr-2',
        selected ? 'border-accent' : 'border-border',
      )}
    >
      <NodeStatusRail status={data.status} hasLoop={metrics.hasLoop} />
      <Handle type="target" position={Position.Top} className="!bg-border" />

      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs font-semibold text-foreground">
          {data.agentName}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {STATUS_LABEL[data.status]}
        </span>
      </div>

      <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
        {data.model ? `${data.model.providerID}/${data.model.id}` : 'modelo —'}
      </div>

      <div className="mt-1 flex items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
        <span>{formatDuration(metrics.durationMs)}</span>
        <span aria-hidden>·</span>
        <span>{formatTokens(totalTokens(metrics.tokens))} tok</span>
        <span aria-hidden>·</span>
        <span>{formatCost(metrics.cost)}</span>
      </div>

      {data.currentTool ? (
        <div className="mt-1 truncate font-mono text-[11px] text-accent">
          {data.currentTool.name}
        </div>
      ) : null}

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
};

export const AgentNode = memo(AgentNodeComponent);
