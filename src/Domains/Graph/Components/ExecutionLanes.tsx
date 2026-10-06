import { ViewportPortal, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@app/Application/lib/utils';
import { formatDuration } from '@app/Application/Helpers';
import type { TNodeStatus } from '../Graph.entity';
import {
  EXECUTION_GUTTER,
  EXECUTION_ROW_HEIGHT,
  type TExecutionPlan,
  type TRowLayout,
} from '../lib/executionLevels';

export const GUTTER_NODE_TYPE = 'gutter';

const STATUS_DOT: Record<TNodeStatus, string> = {
  running: 'bg-status-running',
  waiting: 'bg-status-waiting',
  done: 'bg-status-done',
  error: 'bg-status-error',
  idle: 'bg-status-idle',
};

const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
 * Marcador del gutter izquierdo: número de nivel, ventana temporal, duración y
 * cuántos agentes corrieron en paralelo. El punto se apoya sobre la espina, de
 * modo que la columna se lee como una línea de tiempo.
 */
export const GutterNode = ({ data }: NodeProps<TGutterNode>) => (
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
    <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
      {clock(data.startedAt)}
      <span aria-hidden>·</span>
      {formatDuration(data.endedAt - data.startedAt)}
    </span>
    <span className="font-mono text-[11px] text-muted-foreground">
      {data.count > 1 ? `∥ ${data.count} en paralelo` : '1 agente'}
    </span>
    <span
      aria-hidden
      className={cn(
        'absolute -right-[3.5px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full',
        STATUS_DOT[data.status],
      )}
    />
  </div>
);

/**
 * Nodos (invisibles a la interacción) que sostienen los marcadores del gutter.
 * Al vivir en `x = 0` entran en el `fitView`, así que la espina siempre queda
 * encuadrada junto a los agentes.
 */
export const buildGutterNodes = (
  plan: TExecutionPlan,
  rowLayout: TRowLayout,
  statusByLevel: Record<number, TNodeStatus>,
  activeLevel: number | null,
): TGutterNode[] =>
  plan.levels.map((level) => ({
    id: `gutter-${level.level}`,
    type: GUTTER_NODE_TYPE,
    position: { x: 0, y: rowLayout.top[level.level] ?? 0 },
    width: EXECUTION_GUTTER,
    height: rowLayout.height[level.level] ?? EXECUTION_ROW_HEIGHT,
    selectable: false,
    draggable: false,
    focusable: false,
    data: {
      level: level.level,
      startedAt: level.startedAt,
      endedAt: level.endedAt,
      count: level.nodeIds.length,
      status: statusByLevel[level.level] ?? 'idle',
      active: activeLevel === level.level,
    },
  }));

interface ExecutionLanesProps {
  plan: TExecutionPlan;
  rowLayout: TRowLayout;
  activeLevel: number | null;
}

/**
 * Bandas horizontales por nivel de ejecución, dibujadas en coordenadas de
 * flujo (panean y hacen zoom con el grafo). El carril activo se resalta.
 */
export const ExecutionLanes = ({
  plan,
  rowLayout,
  activeLevel,
}: ExecutionLanesProps) => (
  <ViewportPortal>
    {plan.levels.map((level) => (
      <div
        key={level.level}
        className={cn(
          'lane-in pointer-events-none absolute',
          activeLevel === level.level
            ? 'bg-accent/[0.05]'
            : level.level % 2 === 1
              ? 'bg-white/[0.015]'
              : '',
        )}
        style={{
          left: 0,
          top: rowLayout.top[level.level] ?? 0,
          width: plan.width,
          height: rowLayout.height[level.level] ?? EXECUTION_ROW_HEIGHT,
          zIndex: -1,
        }}
      >
        {level.level > 0 ? (
          <div className="absolute inset-x-0 top-0 h-px bg-border/40" />
        ) : null}
        {activeLevel === level.level ? (
          <div className="absolute inset-y-0 left-0 w-[2px] bg-accent/70" />
        ) : null}
      </div>
    ))}
  </ViewportPortal>
);
