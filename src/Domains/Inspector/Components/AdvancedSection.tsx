import { useId, useState, type ReactNode } from 'react';
import { Button, Container } from '@app/Application/Components';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

interface AdvancedSectionProps {
  /**
   * Estado de expansión inicial cuando no se controla externamente.
   * Por defecto colapsado (FR-010).
   */
  defaultExpanded?: boolean;
  /** Modo controlado opcional; si se define, manda sobre el estado interno. */
  expanded?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

/**
 * Desplegable accesible "Avanzado" (FR-010..FR-012, contrato 3.1).
 *
 * Disclosure sin dependencias nuevas: un `Button` con `aria-expanded` y
 * `aria-controls` alterna una región `role="region"`. El contenido se
 * **renderiza condicionalmente** — colapsado no monta los hijos — y el estado
 * es local y no controlado salvo que se pase `expanded`.
 */
export const AdvancedSection = ({
  defaultExpanded = false,
  expanded,
  onToggle,
  children,
}: AdvancedSectionProps) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const isExpanded = isControlled ? expanded : internalExpanded;
  const contentId = useId();

  const handleToggle = () => {
    if (!isControlled) {
      setInternalExpanded((value) => !value);
    }
    onToggle?.();
  };

  return (
    <Container space="small">
      <Button
        variant="outline"
        showIcon
        icon={isExpanded ? faChevronUp : faChevronDown}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={handleToggle}
        className="h-auto! justify-start! gap-1! border-0! bg-transparent! p-0! font-mono text-[11px] text-muted-foreground shadow-none! hover:bg-transparent! hover:text-foreground"
      >
        Avanzado
      </Button>

      {isExpanded ? (
        <Container
          space="small"
          id={contentId}
          role="region"
          aria-label="Avanzado"
        >
          {children}
        </Container>
      ) : null}
    </Container>
  );
};
