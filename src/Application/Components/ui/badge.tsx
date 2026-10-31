import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/Application/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] transition-colors focus:outline-none focus:ring-2 focus:ring-signal/40 focus:ring-offset-2 focus:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'border-signal/25 bg-signal/10 text-signal',
        secondary: 'border-border bg-surface-2 text-muted-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        outline: 'border-border text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = ({ className, variant, ...props }: BadgeProps) => {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
};

export { Badge, badgeVariants };
