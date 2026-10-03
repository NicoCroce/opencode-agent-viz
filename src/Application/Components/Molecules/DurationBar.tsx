import { cn } from '@app/Application/lib/utils';

interface DurationBarProps {
  ratio: number;
  className?: string;
}

export const DurationBar = ({ ratio, className }: DurationBarProps) => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-flat bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-accent transition-[width] duration-300"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
};
