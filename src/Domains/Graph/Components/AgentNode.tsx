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
  NODE_STATUS_LABEL,
  formatCost,
  formatDateTimeRange,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import type { TGraphNodeData, TTokenUsage } from '../Graph.entity';
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH } from '../lib/nodeResize';
import { isActiveStatus } from '../lib/nodeStatus';
import { NodeStatusRail } from './NodeStatusRail';
import { useNodeFocus } from './NodeFocusContext';

type AgentFlowNode = Node<TGraphNodeData, 'agent'>;

const UNAVAILABLE_LABEL = 'no disponible';

/** Reloj compacto `HH:mm` para el momento del próximo intento (FR-018). */
const formatClock = (ms: number): string => {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  // Resaltado de foco leído por contexto (contrato de render §1.2/§2): el hover
  // **no** atenúa el nodo —solo afecta a las aristas—, así que la opacidad
  // depende exclusivamente del linaje del nodo seleccionado: `1` dentro del
  // linaje y `0.15` fuera. Sin selección no hay atenuación (sin estilo en línea).
  const { selectedNodeId, lineageNodeIds } = useNodeFocus();
  const focusOpacity =
    selectedNodeId === null
      ? undefined
      : lineageNodeIds.has(id)
        ? 1
        : 0.15;

  // Un nodo sigue activo mientras corre, reintenta, compacta o espera
  // permiso/respuesta (FR-015/FR-017); un estado terminal ya no está activo.
  const isRunning = isActiveStatus(data.status);
  const timeRange = formatDateTimeRange({
    startedAt: metrics.startedAt,
    endedAt: metrics.endedAt,
    isRunning,
  });
  const parallel = data.parallel && data.parallel.size > 1 ? data.parallel : null;
  const tokens = totalTokens(metrics.tokens);

  // Reintento (FR-018): número de intento y, si el servidor lo reporta, el
  // momento del próximo. `next` ausente → "no disponible" (edge case).
  const retryLabel = data.retry
    ? `Intento ${data.retry.attempt} · próximo ${
        data.retry.next !== null ? formatClock(data.retry.next) : UNAVAILABLE_LABEL
      }`
    : null;

  // Motivo de la interrupción (FR-019): distingue una interrupción de un fallo
  // propio. Motivo ausente → "no disponible".
  const interruptLabel =
    data.status === 'interrupted'
      ? `Motivo: ${data.interruptReason ?? UNAVAILABLE_LABEL}`
      : null;

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
            {isRunning ? (
              // Señal de progreso perceptible sin depender del texto en
              // generación (FR-022): pulso CSS puro.
              <span
                data-testid="agent-progress"
                aria-hidden
                className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-status-running"
              />
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {NODE_STATUS_LABEL[data.status]}
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

        {/* Pie: consumo + rango horario + herramienta en curso + reintento/interrupción */}
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
          {retryLabel ? (
            <span
              className="min-w-0 truncate font-mono text-[11px] tabular-nums text-status-running"
              title={retryLabel}
            >
              {retryLabel}
            </span>
          ) : null}
          {interruptLabel ? (
            <span
              className="min-w-0 truncate font-mono text-[11px] text-status-error"
              title={interruptLabel}
            >
              {interruptLabel}
            </span>
          ) : null}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
};

export const AgentNode = memo(AgentNodeComponent);
