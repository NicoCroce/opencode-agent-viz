import { useId, useState, type ReactNode } from 'react';
import {
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';
import { Button } from './Button';

/**
 * Estilo canónico del botón de conmutación: botón fantasma en monoespaciado con
 * chevrons. Antes duplicado literalmente en `AdvancedSection` y `ToolHistory`
 * (magic string), ahora en un único lugar.
 */
const DISCLOSURE_BUTTON_CLASSNAME =
  'h-auto! justify-start! gap-1! border-0! bg-transparent! p-0! font-mono text-[11px] text-muted-foreground shadow-none! hover:bg-transparent! hover:text-foreground';

interface DisclosureProps {
  /** Etiqueta visible cuando está colapsado. */
  title: ReactNode;
  /** Etiqueta visible cuando está expandido (por defecto, `title`). */
  expandedTitle?: ReactNode;
  /**
   * Contenido colapsable. Si se omite, `Disclosure` solo renderiza el botón de
   * conmutación (patrón "Ver N más" de `ToolHistory`); si se pasa, el contenido
   * se monta en una región accesible solo cuando está expandido.
   */
  children?: ReactNode;
  /** Estado de expansión inicial en modo no controlado (por defecto, false). */
  defaultExpanded?: boolean;
  /** Modo controlado: si se define, manda sobre el estado interno. */
  expanded?: boolean;
  /** Se invoca en cada conmutación con el siguiente estado. */
  onToggle?: (expanded: boolean) => void;
  /** `id` de la región de contenido (si se omite, se genera uno). */
  contentId?: string;
  /** `aria-label` de la región de contenido (por defecto, `title` si es texto). */
  contentLabel?: string;
  /** Clases extra para el botón. */
  className?: string;
}

/**
 * Sección colapsable accesible (FR-010..FR-012, contrato 3.1).
 *
 * Unifica el toggle de "Avanzado" (`AdvancedSection`) y el "Ver N más / Ver
 * menos" de `ToolHistory`. Expone estado **controlado** (`expanded`) o **no
 * controlado** (`defaultExpanded`, por defecto colapsado) y conserva
 * `aria-expanded`; cuando hay contenido añade `aria-controls` y una región
 * `role="region"`. El contenido se **renderiza condicionalmente**: colapsado no
 * monta los hijos.
 */
export const Disclosure = ({
  title,
  expandedTitle,
  children,
  defaultExpanded = false,
  expanded,
  onToggle,
  contentId,
  contentLabel,
  className,
}: DisclosureProps) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const isExpanded = isControlled ? expanded : internalExpanded;
  const hasContent = children !== undefined;
  const generatedId = useId();
  const regionId = contentId ?? (hasContent ? generatedId : undefined);
  const regionLabel =
    contentLabel ?? (typeof title === 'string' ? title : undefined);

  const handleToggle = () => {
    const next = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  };

  return (
    <>
      <Button
        variant="outline"
        showIcon
        icon={isExpanded ? faChevronUp : faChevronDown}
        aria-expanded={isExpanded}
        aria-controls={regionId}
        onClick={handleToggle}
        className={cn(DISCLOSURE_BUTTON_CLASSNAME, className)}
      >
        {isExpanded ? (expandedTitle ?? title) : title}
      </Button>

      {hasContent && isExpanded ? (
        <Container
          space="small"
          id={regionId}
          role="region"
          aria-label={regionLabel}
        >
          {children}
        </Container>
      ) : null}
    </>
  );
};
