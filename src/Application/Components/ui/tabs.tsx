import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/Application/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex min-h-control flex-wrap items-center justify-center gap-0.5 rounded-lg border border-border/70 bg-surface-1/80 p-0.5 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Trigger del tablist. El estado activo se marca con **borde de contraste +
 * superficie** (no solo color de texto) y conserva el mismo ancho de caja en
 * reposo y activo; el foco usa `outline` (respaldo de `forced-colors`).
 */
const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-xs font-medium text-muted-foreground transition-[background-color,border-color,color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[Highlight] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-foreground data-[state=active]:bg-background data-[state=active]:text-foreground',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[Highlight]',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
