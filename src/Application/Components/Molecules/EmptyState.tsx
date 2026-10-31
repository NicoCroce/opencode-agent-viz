import { AlertMessage } from '../Organisms/AlertMessage';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'link';
  };
  children?: React.ReactNode;
}

export const EmptyState = ({
  title,
  description,
  icon,
  action,
  children,
}: EmptyStateProps) => (
  <AlertMessage
    variant="empty"
    title={title}
    description={description}
    icon={icon}
    action={action}
  >
    {children}
  </AlertMessage>
);
