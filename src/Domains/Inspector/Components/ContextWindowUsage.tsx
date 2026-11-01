import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import {
  DetailRow,
  SectionHeading,
} from '@app/Application/Components/Molecules';
import { formatPercent, formatTokens } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TContextUsage } from '../Inspector.entity';
import {
  contextUsageLevel,
  type TContextUsageLevel,
} from '../lib/contextUsage';

const LEVEL_COLOR: Record<TContextUsageLevel, string> = {
  normal: 'bg-primary',
  high: 'bg-status-waiting',
  critical: 'bg-status-error',
};

/** Etiqueta de la cabecera de la tarjeta (versalitas mono de 10px). */
const WINDOW_LABEL = 'Ventana de contexto';

interface ContextWindowUsageProps {
  /** Tokens del último paso; se muestran solos si no hay límite conocido. */
  windowTokens: number | null;
  /** Uso frente al límite del modelo; `null` si el límite no se conoce. */
  usage: TContextUsage | null;
}

/** Cabecera de la tarjeta: etiqueta a la izquierda, cifra mono a la derecha. */
const WindowHeader = ({ value }: { value: ReactNode }) => (
  <Container
    row
    align="baseline"
    justify="between"
    space="small"
    className="min-w-0"
  >
    <SectionHeading className="text-[10px] tracking-[0.12em]">
      {WINDOW_LABEL}
    </SectionHeading>
    <span className="min-w-0 truncate font-mono text-[13px] tabular-nums text-foreground">
      {value}
    </span>
  </Container>
);

/**
 * Ventana de contexto del nodo: tokens usados y, si el catálogo trae el límite
 * del modelo, el total, el porcentaje y una barra de uso de 8px. El porcentaje
 * va siempre en texto; el color de la barra no es la única señal. Es la
 * cabecera de la tarjeta de contexto que compone `ContextSection`.
 */
export const ContextWindowUsage = ({
  windowTokens,
  usage,
}: ContextWindowUsageProps) => {
  if (usage === null) {
    return <WindowHeader value={formatTokens(windowTokens)} />;
  }

  const percent = usage.ratio * 100;
  const used = formatTokens(usage.usedTokens);
  const limit = formatTokens(usage.limitTokens);

  return (
    <Container space="small">
      <WindowHeader value={`${used} de ${limit}`} />
      <Container
        row
        space="none"
        role="meter"
        aria-label="Uso de la ventana de contexto"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(percent, 100))}
        aria-valuetext={`${formatPercent(percent, 0)}: ${used} de ${limit} tokens`}
        className="h-2 w-full overflow-hidden rounded bg-secondary"
      >
        <span
          className={cn(
            'h-full rounded',
            LEVEL_COLOR[contextUsageLevel(usage.ratio)],
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </Container>
      <DetailRow label="Uso de la ventana" value={formatPercent(percent, 0)} />
    </Container>
  );
};
