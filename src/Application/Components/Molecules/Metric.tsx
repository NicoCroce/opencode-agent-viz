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
    <Container space="none" className={cn('gap-1', className)}>
      <SectionHeading className="text-[9px] tracking-[0.14em]">
        {label}
      </SectionHeading>
      {unavailable ? (
        <UnavailableValue className="font-mono text-[13px] tabular-nums" />
      ) : (
        <span className="font-mono text-[13px] font-medium leading-none tabular-nums text-foreground">
          {value}
        </span>
      )}
      {hint ? (
        <span className="text-[10px] text-muted-foreground/70">{hint}</span>
      ) : null}
    </Container>
  );
};
