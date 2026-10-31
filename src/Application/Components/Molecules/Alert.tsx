import { cva, type VariantProps } from 'class-variance-authority';
import {
  Alert as UIAlert,
  AlertDescription,
} from '@app/Application/Components/ui/alert';
import { cn } from '@/Application/lib/utils';
import { Container } from '@app/Application/Components/Layout';
import { ALERT_VARIANT_ICON } from './alertVariants';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&_h5]:font-display [&_h5]:text-[13px] [&_h5]:font-semibold',
  {
    variants: {
      variant: {
        info: 'border-signal/20 bg-signal/[0.05] text-foreground',
        error: 'border-destructive/25 bg-destructive/[0.06] text-foreground',
        warning:
          'border-status-waiting/25 bg-status-waiting/[0.06] text-foreground',
        success: 'border-status-done/25 bg-status-done/[0.06] text-foreground',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const iconVariants = cva('h-4 w-4', {
  variants: {
    variant: {
      info: 'text-signal',
      error: 'text-destructive',
      warning: 'text-status-waiting',
      success: 'text-status-done',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

interface AlertProps extends VariantProps<typeof alertVariants> {
  message: string;
  title?: string;
  className?: string;
  showIcon?: boolean;
  /**
   * Rol ARIA del contenedor. Opcional: sin valor se conserva el `role="alert"`
   * que aplica `ui/alert` (avisos que interrumpen); un aviso meramente
   * informativo pasa `role="status"`.
   */
  role?: 'alert' | 'status';
  /**
   * `aria-live` del contenedor. Opcional: sin valor no se emite el atributo,
   * así los demás consumidores conservan el comportamiento de `ui/alert`.
   */
  ariaLive?: 'off' | 'polite' | 'assertive';
  /** `data-testid` del contenedor, para el `getByTestId` del consumidor. */
  'data-testid'?: string;
}

export const Alert = ({
  variant = 'info',
  message,
  title,
  className,
  showIcon = true,
  role,
  ariaLive,
  'data-testid': dataTestId,
}: AlertProps) => {
  const Icon = ALERT_VARIANT_ICON[variant || 'info'];

  return (
    <UIAlert
      data-testid={dataTestId}
      variant={variant === 'error' ? 'destructive' : 'default'}
      className={cn(alertVariants({ variant }), className)}
      {...(role ? { role } : {})}
      {...(ariaLive ? { 'aria-live': ariaLive } : {})}
    >
      <Container row space="small" align="center">
        {showIcon && (
          // Decorativo: duplica el significado del `variant`/`title`, así que no
          // debe anunciarse dentro de una región `aria-live` (el aviso de
          // truncamiento) ni de un `role="alert"`.
          <Icon
            className={cn(iconVariants({ variant }), 'size-4')}
            aria-hidden="true"
            strokeWidth={1.8}
          />
        )}
        <div>
          {title && <h5 className="mb-1 font-medium text-sm">{title}</h5>}
          <AlertDescription className="text-sm">{message}</AlertDescription>
        </div>
      </Container>
    </UIAlert>
  );
};
