import { cva, type VariantProps } from 'class-variance-authority';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faTriangleExclamation,
  faCircleCheck,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import {
  Alert as UIAlert,
  AlertDescription,
} from '@app/Application/Components/ui/alert';
import { cn } from '@/Application/lib/utils';
import { Container } from '../../Layout';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        info: 'bg-sky-700/5 border-sky-700/20 text-sky-900 dark:bg-sky-950/20 dark:border-sky-800/30 dark:text-sky-100',
        error:
          'bg-destructive/5 border-destructive/20 text-destructive dark:text-destructive',
        warning:
          'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-100',
        success:
          'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-100',
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
      info: 'text-sky-700 dark:text-sky-400',
      error: 'text-destructive',
      warning: 'text-amber-600 dark:text-amber-400',
      success: 'text-emerald-600 dark:text-emerald-400',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const defaultIcons: Record<string, IconDefinition> = {
  info: faCircleInfo,
  error: faTriangleExclamation,
  warning: faTriangleExclamation,
  success: faCircleCheck,
};

interface AlertProps extends VariantProps<typeof alertVariants> {
  message: string;
  title?: string;
  className?: string;
  showIcon?: boolean;
}

export const Alert = ({
  variant = 'info',
  message,
  title,
  className,
  showIcon = true,
}: AlertProps) => {
  const icon = defaultIcons[variant || 'info'];

  return (
    <UIAlert
      variant={variant === 'error' ? 'destructive' : 'default'}
      className={cn(alertVariants({ variant }), className)}
    >
      <Container row space="small" align="center">
        {showIcon && (
          <FontAwesomeIcon icon={icon} className={iconVariants({ variant })} />
        )}
        <div>
          {title && <h5 className="mb-1 font-medium text-sm">{title}</h5>}
          <AlertDescription className="text-sm">{message}</AlertDescription>
        </div>
      </Container>
    </UIAlert>
  );
};
