import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { Disclosure } from '@app/Application/Components/Molecules';

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
 * Envuelve el `Disclosure` compartido: un `Button` con `aria-expanded` y
 * `aria-controls` alterna una región `role="region"`. El contenido se
 * **renderiza condicionalmente** — colapsado no monta los hijos — y el estado
 * es local y no controlado salvo que se pase `expanded`.
 */
export const AdvancedSection = ({
  defaultExpanded = false,
  expanded,
  onToggle,
  children,
}: AdvancedSectionProps) => (
  <Container space="small">
    <Disclosure
      title="Avanzado"
      defaultExpanded={defaultExpanded}
      expanded={expanded}
      onToggle={onToggle}
    >
      {children}
    </Disclosure>
  </Container>
);
