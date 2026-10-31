import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/Application/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-[0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[Highlight] [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_10px_30px_-16px_hsl(var(--primary)/0.65)] hover:bg-primary/90 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_12px_34px_-14px_hsl(var(--primary)/0.75)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[0_0_0_1px_hsl(var(--destructive)/0.35)] hover:bg-destructive/90',
        outline:
          'border border-border bg-surface-1/70 text-foreground hover:border-signal/40 hover:bg-surface-2 hover:text-foreground',
        secondary:
          'border border-border/80 bg-secondary/80 text-secondary-foreground hover:border-border hover:bg-secondary',
        ghost:
          'text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground',
        link: 'text-signal underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-control px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-control rounded-md px-8',
        icon: 'h-control w-control',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
