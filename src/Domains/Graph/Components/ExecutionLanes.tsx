import { ViewportPortal } from '@xyflow/react';
import { cn } from '@app/Application/lib/utils';
import {
  EXECUTION_ROW_HEIGHT,
  type TExecutionPlan,
  type TRowLayout,
} from '../lib/executionLevels';

// Re-exports de compatibilidad: `AgentGraph` y el spec de `ExecutionLanes`
// siguen importando estas piezas desde `./ExecutionLanes` (DC-19).
export { GUTTER_NODE_TYPE, GutterNode, isGutterNode } from './GutterNode';
export type { TGutterNode, TGutterNodeData } from './GutterNode';
export { buildGutterNodes } from '../lib/buildGutterNodes';

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
          // Sin bandas alternas: el lienzo es la retícula de puntos y solo el
          // carril activo se tiñe de cyan.
          activeLevel === level.level && 'bg-accent/[0.04]',
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
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-border/60" />
        ) : null}
        {activeLevel === level.level ? (
          <div className="absolute inset-y-0 left-0 w-[2px] bg-accent/70" />
        ) : null}
      </div>
    ))}
  </ViewportPortal>
);
