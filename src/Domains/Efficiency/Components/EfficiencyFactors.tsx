import { CircleMinus, CirclePlus, type LucideIcon } from 'lucide-react';
import { Container } from '@app/Application/Components';
import { SectionHeading } from '@app/Application/Components/Molecules';
import { cn } from '@app/Application/lib/utils';
import type { TFactor } from '../Efficiency.entity';
import { DIMENSION_LABEL } from '../lib/labels';

export interface EfficiencyFactorsProps {
  /** Factores ya ordenados por impacto por el motor (2–3 en `ok`). */
  factors: TFactor[];
}

const KIND_LABEL: Record<TFactor['kind'], string> = {
  resta: 'resta',
  suma: 'suma',
};

const KIND_ICON: Record<TFactor['kind'], LucideIcon> = {
  resta: CircleMinus,
  suma: CirclePlus,
};

const KIND_TONE: Record<TFactor['kind'], string> = {
  resta: 'text-status-waiting',
  suma: 'text-status-done',
};

/**
 * Factores de impacto del veredicto (FR-015; contrato overlay §5.2): 2–3
 * indicadores con su etiqueta, la dimensión a la que pertenecen, el conteo y el
 * signo `resta`/`suma`. El orden llega resuelto desde `buildFactors`; la tarjeta
 * no inventa puntos (esos viven en “Cómo se calcula”).
 *
 * Presentación pura: no calcula impacto ni accede a datos. El icono del signo
 * es decorativo y el texto del signo sigue siendo legible sin color.
 */
export const EfficiencyFactors = ({ factors }: EfficiencyFactorsProps) => {
  if (factors.length === 0) return null;

  return (
    <Container space="small">
      <SectionHeading>Factores de impacto</SectionHeading>

      <ul className="flex flex-col gap-2">
        {factors.map((factor) => {
          const Icon = KIND_ICON[factor.kind];

          return (
            <li
              key={factor.key}
              className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            >
              <Icon
                aria-hidden
                className={cn('size-3 shrink-0', KIND_TONE[factor.kind])}
              />
              <span className="min-w-0 font-medium text-foreground">
                {factor.label}
              </span>
              <span className="text-muted-foreground">
                {DIMENSION_LABEL[factor.dimension]}
              </span>
              <span
                className={cn(
                  'ml-auto shrink-0 font-mono tabular-nums',
                  KIND_TONE[factor.kind],
                )}
              >
                {KIND_LABEL[factor.kind]} · {factor.count}
              </span>
            </li>
          );
        })}
      </ul>
    </Container>
  );
};
