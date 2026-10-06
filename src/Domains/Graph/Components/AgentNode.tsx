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

/**
 * Card del agente: título (máx. 2 líneas) + estado, la línea de modelo (nombre
 * y variante) y un pie con tokens · costo · duración, el rango horario y la
 * herramienta en curso.
 *
 * El alto lo calcula `cardHeight` según el contenido (ver `lib/cardHeight.ts`),
 * y los carriles de ejecución usan ese mismo alto para no recortar el card.
 */
const AgentNodeComponent = ({ id, data, selected }: NodeProps<AgentFlowNode>) => {
  const { metrics } = data;

  // Un nodo sigue "en curso" mientras corre o espera (FR-015).
  const isRunning = data.status === 'running' || data.status === 'waiting';
  const timeRange = formatTimeRange({
    startedAt: metrics.startedAt,
    endedAt: metrics.endedAt,
    isRunning,
  });
  const parallel = data.parallel && data.parallel.size > 1 ? data.parallel : null;
  const tokens = totalTokens(metrics.tokens);

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

      <div className="flex h-full w-full min-w-0 flex-col overflow-hidden py-2.5 pl-3 pr-2.5">
        {/* Encabezado: tarea (máx. 2 líneas) + paralelismo + estado */}
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-snug text-foreground">
            {data.title ?? data.agentName}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {parallel ? (
              <span
                className="rounded-flat border border-foreground/40 px-1 font-mono text-[10px] leading-4 text-foreground"
                title={`${parallel.size} agentes ejecutados en paralelo`}
              >
                {`∥${parallel.size}`}
              </span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {STATUS_LABEL[data.status]}
            </span>
          </span>
        </div>

        {/* Línea de modelo: nombre a la izquierda, variante a la derecha */}
        {data.model ? (
          <span className="mt-1 flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 break-all font-mono text-[11px] leading-snug text-foreground">
              {`${data.model.providerID}/${data.model.id}`}
            </span>
            {data.model.variant ? (
              <span className="shrink-0 rounded-flat border border-border px-1 font-mono text-[10px] leading-4 text-muted-foreground">
                {data.model.variant}
              </span>
            ) : null}
          </span>
        ) : null}

        {/* Pie: consumo resumido + rango horario + herramienta en curso */}
        <div className="mt-auto flex min-w-0 flex-col gap-1 border-t border-border pt-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            <span>
              {tokens === null ? formatTokens(null) : `${formatTokens(tokens)} tok`}
            </span>
            <span aria-hidden>·</span>
            <span>{formatCost(metrics.cost)}</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(metrics.durationMs)}</span>
          </div>
          <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-muted-foreground">
            {timeRange}
          </span>
          {data.currentTool ? (
            <span
              className="min-w-0 truncate font-mono text-[11px] text-foreground/80"
              title={data.currentTool.name}
            >
              {data.currentTool.name}
            </span>
          ) : null}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
};

export const AgentNode = memo(AgentNodeComponent);
