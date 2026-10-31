import type { LucideIcon } from 'lucide-react';
import { Container } from '@app/Application/Components/Layout';
import { cn } from '@app/Application/lib/utils';
import {
  ALERT_VARIANT_ICON,
  iconContainerVariants,
  type TAlertVariant,
} from './alertVariants';

interface AlertIconBadgeProps {
  /** Variante de alerta; define color, fondo y el icono por defecto. */
  variant: TAlertVariant;
  /** Icono explícito; si se omite usa `ALERT_VARIANT_ICON[variant]`. */
  icon?: LucideIcon;
  className?: string;
}

/**
 * Círculo con el icono de una variante de alerta (SH-16).
 *
 * Extraído de `AlertMessage` (`iconContainerVariants` + `defaultIcons`): el
 * icono por defecto ahora sale del mapa compartido `ALERT_VARIANT_ICON`, tipado
 * contra `TAlertVariant`.
 */
export const AlertIconBadge = ({
  variant,
  icon,
  className,
}: AlertIconBadgeProps) => {
  const Icon = icon ?? ALERT_VARIANT_ICON[variant];

  return (
    <Container
      align="center"
      justify="center"
      space="none"
      className={cn(iconContainerVariants({ variant }), className)}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.7} />
    </Container>
  );
};
