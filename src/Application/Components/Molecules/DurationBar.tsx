import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';

/** Tono del relleno: `accent` (destacado) o `muted` (el resto de la serie). */
export type TDurationBarTone = 'accent' | 'muted';

const TONE_CLASSNAME: Record<TDurationBarTone, string> = {
  accent: 'bg-accent',
  muted: 'bg-muted-foreground',
};

interface DurationBarProps {
  ratio: number;
  /** Tono del relleno (por defecto `accent`). */
  tone?: TDurationBarTone;
  /**
   * Barra decorativa: el dato ya está en texto junto a ella, así que se oculta
   * a tecnologías de asistencia en lugar de exponer un `progressbar` sin nombre.
   */
  decorative?: boolean;
  className?: string;
}

/**
 * Barra fina de duración relativa (0..1). La pista es `secondary` y el relleno
 * se alinea a la derecha, como la columna de tiempo que acompaña.
 */
export const DurationBar = ({
  ratio,
  tone = 'accent',
  decorative = false,
  className,
}: DurationBarProps) => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const a11y = decorative
    ? { 'aria-hidden': true }
    : {
        role: 'progressbar',
        'aria-valuenow': Math.round(clamped * 100),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      };

  return (
    <Container
      row
      space="none"
      justify="end"
      className={cn(
        'h-0.5 w-full overflow-hidden rounded-[1px] bg-secondary',
        className,
      )}
      {...a11y}
    >
      <span
        className={cn(
          'h-full rounded-[1px] transition-[width] duration-300',
          TONE_CLASSNAME[tone],
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </Container>
  );
};
