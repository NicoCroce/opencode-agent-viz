import { cn } from '@app/Application/lib/utils';
import { UNAVAILABLE } from '@app/Application/Helpers/formatDuration';

interface MetricProps {
  label: string;
  value: string | null;
  hint?: string;
  className?: string;
}

export const Metric = ({ label, value, hint, className }: MetricProps) => {
  const unavailable = value === null || value === undefined;

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {unavailable ? (
        <span
          className="font-mono text-sm tabular-nums text-muted-foreground"
          aria-label="no disponible"
        >
          {UNAVAILABLE}
          <span className="sr-only"> no disponible</span>
        </span>
      ) : (
        <span className="font-mono text-sm font-medium tabular-nums text-foreground">
          {value}
        </span>
      )}
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
};
