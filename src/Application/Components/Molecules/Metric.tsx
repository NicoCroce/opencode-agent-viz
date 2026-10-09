import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';
import { SectionHeading } from './SectionHeading';
import { UnavailableValue } from './UnavailableValue';

interface MetricProps {
  label: string;
  value: string | null;
  hint?: string;
  className?: string;
}

export const Metric = ({ label, value, hint, className }: MetricProps) => {
  const unavailable = value === null || value === undefined;

  return (
    <Container space="none" className={cn('gap-0.5!', className)}>
      <SectionHeading>{label}</SectionHeading>
      {unavailable ? (
        <UnavailableValue className="font-mono text-sm tabular-nums" />
      ) : (
        <span className="font-mono text-sm font-medium tabular-nums text-foreground">
          {value}
        </span>
      )}
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </Container>
  );
};
