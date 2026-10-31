import { type VariantProps } from 'class-variance-authority';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@app/Application/Components/Molecules/Button';
import { cn } from '@/Application/lib/utils';
import { Container } from '../..';
import { AlertIconBadge } from '../Molecules/AlertIconBadge';
import {
  ALERT_VARIANT_DESCRIPTION,
  ALERT_VARIANT_TITLE,
  emptyStateVariants,
} from '../Molecules/alertVariants';

interface AlertMessageProps extends VariantProps<typeof emptyStateVariants> {
  title?: string;
  description?: string | null;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'link';
  };
  className?: string;
  children?: React.ReactNode;
}

export const AlertMessage = ({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  className,
  children,
}: AlertMessageProps) => {
  const resolvedVariant = variant || 'empty';
  const displayTitle = title || ALERT_VARIANT_TITLE[resolvedVariant];
  const displayDescription =
    description === undefined
      ? ALERT_VARIANT_DESCRIPTION[resolvedVariant]
      : description;

  return (
    <Container
      space="small"
      align="start"
      className={cn(
        emptyStateVariants({ variant: resolvedVariant }),
        'max-w-2xl',
        className,
      )}
    >
      <AlertIconBadge variant={resolvedVariant} icon={icon} />

      <Container align="start" space="small" className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold leading-snug tracking-[-0.02em] text-foreground">
          {displayTitle}
        </h3>
        {displayDescription && (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {displayDescription}
          </p>
        )}

        {action && (
          <Button
            variant={action.variant || 'link'}
            onClick={action.onClick}
            showIcon={false}
            className="mt-1 h-auto p-0 text-[13px]"
          >
            {action.label}
          </Button>
        )}

        {children}
      </Container>
    </Container>
  );
};
