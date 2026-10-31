import * as React from 'react';

import { cn } from '@/Application/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        autoComplete="off"
        className={cn(
          'flex h-control w-full rounded-md border border-border/80 bg-input/60 px-3 py-1 text-sm text-foreground transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/70 file:border-0 file:bg-transparent file:text-sm file:font-medium hover:border-border focus-visible:border-signal/55 focus-visible:bg-input/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/20 disabled:cursor-not-allowed disabled:opacity-50 forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[Highlight]',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
