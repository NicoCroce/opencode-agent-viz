import { type Node, type NodeProps } from '@xyflow/react';
import { NODE_STATUS_COLOR } from '@app/Application/Helpers/nodeStatusColor';
import { cn } from '@app/Application/lib/utils';
import { formatDateTimeRange, formatDuration } from '@app/Application/Helpers';
import type { TNodeStatus } from '../Graph.entity';
import { isActiveStatus } from '../lib/nodeStatus';

export const GUTTER_NODE_TYPE = 'gutter';

export interface TGutterNodeData extends Record<string, unknown> {
  level: number;
  startedAt: number;
  endedAt: number;
  count: number;
  status: TNodeStatus;
  active: boolean;
}

export type TGutterNode = Node<TGutterNodeData, typeof GUTTER_NODE_TYPE>;

/**
 * Predicado del marcador de gutter, para los guards de `AgentGraph` sin el cast
 * `String(node.type)`. El tipo del nodo vive aquí junto a su componente.
 */
export const isGutterNode = (node: { type?: unknown }): boolean =>
  node.type === GUTTER_NODE_TYPE;

/**
 * Marcador del gutter izquierdo: número de nivel, ventana temporal (fecha y hora
 * de inicio y de fin), duración y cuántos agentes corrieron en paralelo. El punto
 * se apoya sobre la espina, de modo que la columna se lee como una línea de
 * tiempo. El color del punto usa `NODE_STATUS_COLOR`, la única fuente de verdad
 * de los 9 estados (FR-023), compartida con `NodeStatusRail` y `StatusDot`.
 */
export const GutterNode = ({ data }: NodeProps<TGutterNode>) => {
  // Un nivel sigue "en curso" mientras alguno de sus agentes está activo
  // (corre, reintenta, compacta o espera); el fin se muestra como "en curso" en
  // lugar de una hora que cambia sola.
  const isRunning = isActiveStatus(data.status);
  const timeRange = formatDateTimeRange({
    startedAt: data.startedAt,
    endedAt: data.endedAt,
    isRunning,
  });

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col justify-center gap-1 border-r px-4',
        data.active ? 'border-accent/70' : 'border-border/70',
      )}
    >
      <span
        className={cn(
          'font-mono text-base font-semibold leading-none tabular-nums',
          data.active ? 'text-accent' : 'text-foreground/85',
        )}
      >
        {String(data.level).padStart(2, '0')}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {timeRange}
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        <span>{formatDuration(data.endedAt - data.startedAt)}</span>
        <span aria-hidden>·</span>
        <span>{data.count > 1 ? `∥ ${data.count} en paralelo` : '1 agente'}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute -right-[3.5px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full',
          NODE_STATUS_COLOR[data.status],
        )}
      />
    </div>
  );
};
