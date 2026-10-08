import type { TNodeStatus } from '../Graph.entity';
import { GUTTER_NODE_TYPE, type TGutterNode } from '../Components/GutterNode';
import {
  EXECUTION_GUTTER,
  EXECUTION_ROW_HEIGHT,
  type TExecutionPlan,
  type TRowLayout,
} from './executionLevels';

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
      status: statusByLevel[level.level] ?? 'created',
      active: activeLevel === level.level,
    },
  }));
