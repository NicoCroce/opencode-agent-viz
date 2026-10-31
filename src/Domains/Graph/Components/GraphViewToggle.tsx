import { Container } from '@app/Application/Components';
import { cn } from '@app/Application/lib/utils';
import {
  GRAPH_VIEW_MODE_LABEL,
  GRAPH_VIEW_MODES,
  type TGraphViewMode,
} from '../lib/graphViewMode';

/** Nombre accesible del grupo de vistas. */
export const GRAPH_VIEW_TOGGLE_LABEL = 'Vista del lienzo';

interface GraphViewToggleProps {
  mode: TGraphViewMode;
  onChange: (mode: TGraphViewMode) => void;
}

/**
 * Selector segmentado Grafo | Carriles (esquina del lienzo). Presentación pura:
 * cada opción es un botón con `aria-pressed`; el estado vive en
 * `useGraphViewMode`.
 */
export const GraphViewToggle = ({ mode, onChange }: GraphViewToggleProps) => (
  <Container
    row
    space="none"
    role="group"
    aria-label={GRAPH_VIEW_TOGGLE_LABEL}
    className="gap-[3px] rounded-lg border border-border bg-muted p-[3px]"
  >
    {GRAPH_VIEW_MODES.map((option) => {
      const isActive = option === mode;
      return (
        <button
          key={option}
          type="button"
          aria-pressed={isActive}
          onClick={() => onChange(option)}
          className={cn(
            'h-7 rounded-md px-3 text-xs transition-colors',
            isActive
              ? 'bg-secondary font-medium text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {GRAPH_VIEW_MODE_LABEL[option]}
        </button>
      );
    })}
  </Container>
);
