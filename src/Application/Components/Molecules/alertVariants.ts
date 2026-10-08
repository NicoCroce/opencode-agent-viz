import { cva } from 'class-variance-authority';
import {
  faCircleCheck,
  faCircleInfo,
  faInbox,
  faMagnifyingGlass,
  faTriangleExclamation,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Variantes de alerta/vacío compartidas por `Alert` y `AlertMessage` (SH-16).
 *
 * Antes había dos mapas de iconos sin tipar (`AlertMessage.defaultIcons` y
 * `Alert.defaultIcons`), tres mapas de texto sin tipar y dos `cva` en
 * `AlertMessage`; aquí quedan como fuente única y tipados contra `TAlertVariant`.
 * El conjunto es la unión de los seis estados que hoy conoce cada componente:
 * `error`/`warning`/`info`/`success` (ambos) y `empty`/`search` (solo
 * `AlertMessage`).
 */
export type TAlertVariant =
  | 'error'
  | 'warning'
  | 'info'
  | 'success'
  | 'empty'
  | 'search';

/** Icono por variante; `error` y `warning` comparten el mismo triángulo. */
export const ALERT_VARIANT_ICON: Record<TAlertVariant, IconDefinition> = {
  error: faTriangleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
  success: faCircleCheck,
  empty: faInbox,
  search: faMagnifyingGlass,
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
  'flex flex-col items-center justify-center text-center p-4 rounded-xl animate-in fade-in duration-300',
  {
    variants: {
      variant: {
        error: 'bg-destructive/5 border border-destructive/20',
        warning:
          'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30',
        info: 'bg-sky-700/5 border border-sky-700/20',
        success:
          'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30',
        empty: 'bg-muted/50 border border-border',
        search: 'bg-muted/30 border border-dashed border-muted-foreground/30',
      },
    },
    defaultVariants: {
      variant: 'empty',
    },
  },
);

/** Estilos del contenedor del icono de `AlertMessage` (la otra `cva` de origen). */
export const iconContainerVariants = cva(
  'flex items-center justify-center w-16 h-16 rounded-full',
  {
    variants: {
      variant: {
        error: 'bg-destructive/10 text-destructive',
        warning:
          'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
        info: 'bg-sky-700/10 text-sky-700',
        success:
          'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
        empty: 'bg-muted text-muted-foreground',
        search: 'bg-muted text-muted-foreground/70',
      },
    },
    defaultVariants: {
      variant: 'empty',
    },
  },
);
