import { AlertMessage } from '../Organisms/AlertMessage';

interface EmptyScreenFilterProps {
  onClick?: () => void;
  actionLabel?: string;
}

export const EmptyScreenFilter = ({
  onClick,
  actionLabel = 'Actualizar filtros',
}: EmptyScreenFilterProps) => (
  <AlertMessage
    variant="search"
    title="No se encontraron coincidencias"
    action={onClick ? { label: actionLabel, onClick, variant: 'link' } : undefined}
  />
);
