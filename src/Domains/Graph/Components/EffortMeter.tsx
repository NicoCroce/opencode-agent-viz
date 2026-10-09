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
 * regleta de `EFFORT_MAX` muescas de **solo lectura**. Las encendidas usan
 * `--primary` (exclusivo del esfuerzo); las apagadas, un borde neutro. Mientras
 * el nivel es provisional, el medidor se atenúa. Expone `role="img"` con la
 * leyenda "Esfuerzo N de 5: <reasons>" (nunca es un control, FR-027).
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
      className={cn('shrink-0', provisional && 'opacity-60')}
      style={{ gap: '3px' }}
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
              'h-2.5 w-[3px] rounded-[1px]',
              lit ? 'bg-primary' : 'bg-border',
            )}
          />
        );
      })}
    </Container>
  );
};
