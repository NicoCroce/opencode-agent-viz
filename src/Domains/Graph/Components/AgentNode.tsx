import { memo } from 'react';
import {
  Handle,
  NodeResizer,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { cn } from '@app/Application/lib/utils';
import {
  formatCost,
  formatDuration,
  formatTimeRange,
  formatTokens,
} from '@app/Application/Helpers';
import type { TGraphNodeData, TNodeStatus, TTokenUsage } from '../Graph.entity';
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH } from '../lib/nodeResize';
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

/**
 * Tiradores planos (sin sombra) ocultos por defecto y revelados en
 * hover/focus/selected (FR-004). `pointer-events-none` evita arrastrar
 * controles invisibles cuando el nodo no está activo.
 */
const resizeControlClassName = (selected: boolean): string =>
  selected
    ? 'opacity-100'
    : 'pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100';

const AgentNodeComponent = ({ id, data, selected }: NodeProps<AgentFlowNode>) => {
  const { metrics } = data;

  // Un nodo sigue "en curso" mientras corre o espera (FR-015).
  const isRunning = data.status === 'running' || data.status === 'waiting';
  const timeRange = formatTimeRange({
    startedAt: metrics.startedAt,
    endedAt: metrics.endedAt,
    isRunning,
  });

  return (
    <div
      className={cn(
        'group relative h-full w-full min-w-0 rounded-flat border bg-surface-2',
        selected ? 'border-accent' : 'border-border',
        // Color de tiradores: `--border` en reposo y `--accent` en hover/selected.
        selected
          ? '[--xy-resize-background-color:hsl(var(--accent))]'
          : '[--xy-resize-background-color:hsl(var(--border))] group-hover:[--xy-resize-background-color:hsl(var(--accent))]',
      )}
    >
      <NodeResizer
        nodeId={id}
        isVisible
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        lineClassName={resizeControlClassName(selected)}
        handleClassName={resizeControlClassName(selected)}
        handleStyle={{ border: 'none', borderRadius: 0 }}
      />
      <NodeStatusRail status={data.status} hasLoop={metrics.hasLoop} />
      <Handle type="target" position={Position.Top} className="!bg-border" />

      <div className="flex h-full w-full min-w-0 flex-col overflow-hidden py-2 pl-3 pr-2">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate font-mono text-xs font-semibold text-foreground">
            {data.agentName}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {STATUS_LABEL[data.status]}
          </span>
        </div>

        <div className="mt-0.5 min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {data.model ? `${data.model.providerID}/${data.model.id}` : 'modelo —'}
        </div>

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{formatDuration(metrics.durationMs)}</span>
          <span aria-hidden>·</span>
          <span>{timeRange}</span>
          <span aria-hidden>·</span>
          <span>{formatTokens(totalTokens(metrics.tokens))} tok</span>
          <span aria-hidden>·</span>
          <span>{formatCost(metrics.cost)}</span>
        </div>

        {data.currentTool ? (
          <div className="mt-1 min-w-0 truncate font-mono text-[11px] text-accent">
            {data.currentTool.name}
          </div>
        ) : null}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
};

export const AgentNode = memo(AgentNodeComponent);
