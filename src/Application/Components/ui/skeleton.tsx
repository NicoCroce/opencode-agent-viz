import { cn } from '@/Application/lib/utils';

const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-2/90 ring-1 ring-inset ring-border/40',
        className,
      )}
      {...props}
    />
  );
};

export { Skeleton };
