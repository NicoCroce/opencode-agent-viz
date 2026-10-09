import { Container } from '@app/Application/Components';
import { cn } from '@app/Application/lib/utils';
import type { TNodeEffort } from '../Graph.entity';
import { EFFORT_MAX } from '../lib/effort/constants';

interface EffortMeterProps {
  /** Nivel de esfuerzo derivado; `null`/`undefined` → no se renderiza nada. */
  effort: TNodeEffort | null | undefined;
}

const NOTCHES = Array.from({ length: EFFORT_MAX }, (_, index) => index);

/** Motivo legible cuando el nivel base no acumula condiciones (FR-026). */
const BASE_REASON = 'esfuerzo base';

/**
 * Medidor de esfuerzo del nodo (S9; effort-contract §5; design-direction §3.6):
 * barra de `EFFORT_MAX` segmentos que **ocupa el ancho disponible** (`flex-1`),
 * de **solo lectura**. Los encendidos usan `--primary` (exclusivo del esfuerzo);
 * los apagados, un borde neutro. Mientras el nivel es provisional, el medidor se
 * atenúa. Expone `role="img"` con la leyenda "Esfuerzo N de 5: <reasons>" (nunca
 * es un control, FR-027). La etiqueta y el nivel los aporta `AgentNodeEffortBand`.
 */
export const EffortMeter = ({ effort }: EffortMeterProps) => {
  if (!effort) return null;

  const { level, provisional, reasons } = effort;
  const detail = reasons.length > 0 ? reasons.join(', ') : BASE_REASON;

  return (
    <Container
      row
      align="center"
      space="none"
      role="img"
      aria-label={`Esfuerzo ${level} de 5: ${detail}`}
      data-provisional={provisional}
      className={cn('min-w-0 flex-1', provisional && 'opacity-60')}
      style={{ gap: '2px' }}
    >
      {NOTCHES.map((index) => {
        const lit = index < level;
        return (
          <span
            key={index}
            data-testid="effort-notch"
            data-lit={lit}
            aria-hidden
            className={cn(
              'h-0.5 flex-1 rounded-[1px]',
              lit ? 'bg-primary' : 'bg-border',
            )}
          />
        );
      })}
    </Container>
  );
};
