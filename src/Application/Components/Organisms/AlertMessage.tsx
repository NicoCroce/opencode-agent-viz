import { type VariantProps } from 'class-variance-authority';
import { type IconDefinition } from '@fortawesome/free-solid-svg-icons';
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
  icon?: IconDefinition;
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
      space="large"
      row
      justify="start"
      className={cn(emptyStateVariants({ variant: resolvedVariant }), className)}
    >
      <AlertIconBadge variant={resolvedVariant} icon={icon} />

      <Container align="start" space="none">
        <h3 className="text-lg font-semibold text-foreground">
          {displayTitle}
        </h3>
        {displayDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {displayDescription}
          </p>
        )}

        {action && (
          <Button
            variant={action.variant || 'default'}
            onClick={action.onClick}
            showIcon={false}
            className="p-0 leading-relaxed h-auto mt-2"
          >
            {action.label}
          </Button>
        )}

        {children}
      </Container>
    </Container>
  );
};
