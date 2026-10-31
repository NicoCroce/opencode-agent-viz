import * as React from 'react';

import { cn } from '@/Application/lib/utils';
import { useIsEditable } from '@/Application/Hooks/useIsEditable';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, disabled, ...props }, ref) => {
    const isEditable = useIsEditable();
    return (
      <textarea
        className={cn(
          'flex min-h-control-2x w-full rounded-md border border-border/80 bg-input/60 px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/70 hover:border-border focus-visible:border-signal/55 focus-visible:bg-input/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/20 disabled:cursor-not-allowed disabled:opacity-50 forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[Highlight]',
          className,
        )}
        ref={ref}
        disabled={disabled ?? !isEditable}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
