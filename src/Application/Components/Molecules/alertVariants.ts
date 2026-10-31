import { cva } from 'class-variance-authority';
import {
  CheckCircle2,
  CircleAlert,
  Inbox,
  Search,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

/**
 * Variantes de alerta/vacío compartidas por `Alert` y `AlertMessage` (SH-16).
 *
 * Los colores salen de tokens semánticos (`destructive`, `status-waiting`,
 * `signal`, `status-done`), nunca de la paleta cruda: así el tema cyan se
 * mantiene coherente en todos los estados.
 */
export type TAlertVariant =
  'error' | 'warning' | 'info' | 'success' | 'empty' | 'search';

/** Icono por variante; `error` y `warning` comparten el mismo triángulo. */
export const ALERT_VARIANT_ICON: Record<TAlertVariant, LucideIcon> = {
  error: TriangleAlert,
  warning: TriangleAlert,
  info: CircleAlert,
  success: CheckCircle2,
  empty: Inbox,
  search: Search,
};

/** Título por defecto por variante. */
export const ALERT_VARIANT_TITLE: Record<TAlertVariant, string> = {
  error: 'Algo salió mal',
  warning: 'Atención',
  info: 'Información',
  success: 'Completado',
  empty: 'Sin resultados',
  search: 'Sin coincidencias',
};

/** Descripción por defecto por variante. */
export const ALERT_VARIANT_DESCRIPTION: Record<TAlertVariant, string> = {
  error: 'Ocurrió un error al procesar tu solicitud. Intenta nuevamente.',
  warning: 'Revisa los datos antes de continuar.',
  info: 'No hay información disponible en este momento.',
  success: 'La operación se completó exitosamente.',
  empty: 'No hay elementos para mostrar.',
  search: 'Prueba ajustando los filtros o cambiando los términos de búsqueda.',
};

/** Estilos del contenedor de `AlertMessage` (una de las dos `cva` de origen). */
export const emptyStateVariants = cva(
  'flex flex-col gap-4 p-6 rounded-xl animate-in fade-in duration-300 sm:flex-row',
  {
    variants: {
      variant: {
        error: 'border border-destructive/25 bg-destructive/[0.05]',
        warning: 'border border-status-waiting/25 bg-status-waiting/[0.05]',
        info: 'border border-signal/20 bg-signal/[0.04]',
        success: 'border border-status-done/25 bg-status-done/[0.05]',
        empty: 'border border-border/70 bg-surface-1/50',
        search: 'border border-dashed border-border bg-surface-1/40',
      },
    },
    defaultVariants: {
      variant: 'empty',
    },
  },
);

/** Estilos del contenedor del icono de `AlertMessage` (la otra `cva` de origen). */
export const iconContainerVariants = cva(
  'flex size-11 shrink-0 items-center justify-center rounded-lg border',
  {
    variants: {
      variant: {
        error: 'border-destructive/25 bg-destructive/10 text-destructive',
        warning:
          'border-status-waiting/25 bg-status-waiting/10 text-status-waiting',
        info: 'border-signal/25 bg-signal/10 text-signal',
        success: 'border-status-done/25 bg-status-done/10 text-status-done',
        empty: 'border-border/70 bg-surface-2/80 text-muted-foreground',
        search: 'border-border/70 bg-surface-2/80 text-muted-foreground/80',
      },
    },
    defaultVariants: {
      variant: 'empty',
    },
  },
);
