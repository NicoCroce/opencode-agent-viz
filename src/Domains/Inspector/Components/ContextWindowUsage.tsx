import { Container } from '@app/Application/Components';
import { DetailRow } from '@app/Application/Components/Molecules';
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

interface ContextWindowUsageProps {
  /** Tokens del último paso; se muestran solos si no hay límite conocido. */
  windowTokens: number | null;
  /** Uso frente al límite del modelo; `null` si el límite no se conoce. */
  usage: TContextUsage | null;
}

/**
 * Ventana de contexto del nodo: tokens usados y, si el catálogo trae el límite
 * del modelo, el total, el porcentaje y una barra de uso. El porcentaje va
 * siempre en texto; el color de la barra no es la única señal.
 */
export const ContextWindowUsage = ({
  windowTokens,
  usage,
}: ContextWindowUsageProps) => {
  if (usage === null) {
    return (
      <DetailRow label="Ventana de contexto" value={formatTokens(windowTokens)} />
    );
  }

  const percent = usage.ratio * 100;
  const used = formatTokens(usage.usedTokens);
  const limit = formatTokens(usage.limitTokens);

  return (
    <Container space="none" className="gap-1">
      <DetailRow label="Ventana de contexto" value={`${used} de ${limit}`} />
      <DetailRow label="Uso de la ventana" value={formatPercent(percent, 0)} />
      <Container
        row
        space="none"
        role="meter"
        aria-label="Uso de la ventana de contexto"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(percent, 100))}
        aria-valuetext={`${formatPercent(percent, 0)}: ${used} de ${limit} tokens`}
        className="h-1.5 w-full overflow-hidden rounded-flat border border-border bg-muted"
      >
        <span
          className={cn('h-full', LEVEL_COLOR[contextUsageLevel(usage.ratio)])}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </Container>
    </Container>
  );
};
