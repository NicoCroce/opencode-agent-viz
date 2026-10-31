import * as React from 'react';
import { Button as LibButton, ButtonProps } from '../ui/button';
import { cn } from '@app/Application/lib/utils';
import {
  Check,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';

const CustomButtonOptions = {
  cancel: { icon: X, variant: 'outline', text: 'Cancelar' },
  accept: { icon: Check, variant: 'default', text: 'Aceptar' },
  save: { icon: Save, variant: 'default', text: 'Guardar' },
  delete: { icon: Trash2, variant: 'destructive', text: 'Eliminar' },
  default: { icon: undefined, variant: undefined, text: undefined },
} as const;

type TCustomButtonOptions = typeof CustomButtonOptions;
type TKeys = keyof TCustomButtonOptions;

interface CustomlButtonNewProps extends ButtonProps {
  appearance?: TKeys;
  showLabel?: boolean;
  showIcon?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
  type?: 'submit' | 'reset' | 'button' | undefined;
  variant?: ButtonProps['variant'];
  disabled?: boolean;
  icon?: LucideIcon;
}

/**
 * Botón de la aplicación: envuelve el primitivo `ui/button` con el set de
 * apariencias del producto (cancelar, aceptar, guardar, eliminar) y un icono
 * Lucide de trazo, coherente con el resto de la consola.
 */
export const Button = React.forwardRef<
  HTMLButtonElement,
  CustomlButtonNewProps
>(
  (
    {
      appearance = 'default',
      onClick,
      showLabel = true,
      showIcon = false,
      isLoading = false,
      children,
      type = 'button',
      variant = 'default',
      disabled = false,
      className,
      icon,
      ...props
    },
    ref,
  ) => {
    const {
      variant: _variant,
      icon: iconPreset,
      text,
    } = CustomButtonOptions[appearance];
    const Icon = icon ?? iconPreset;

    return (
      <LibButton
        {...props}
        ref={ref}
        onClick={onClick}
        variant={_variant ? _variant : variant}
        className={cn('cursor-pointer gap-2 px-4 py-2', className)}
        disabled={disabled || isLoading}
        type={type}
      >
        {isLoading ? (
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
        ) : showIcon && Icon ? (
          <Icon aria-hidden className="size-3.5" strokeWidth={1.9} />
        ) : null}
        {appearance === 'default' && children
          ? children
          : (showLabel && text) || ''}
      </LibButton>
    );
  },
);

Button.displayName = 'Button';

export { CheckCircle2 as SuccessIcon };
