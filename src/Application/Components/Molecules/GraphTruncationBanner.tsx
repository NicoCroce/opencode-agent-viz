import { Alert } from './Alert';

/** Título del aviso: informativo, sin cifras ni "N de M" (FR-006, SC-009). */
const TRUNCATION_TITLE = 'Vista parcial';

/**
 * Texto del aviso: declara el corte sin ofrecer salida y sin exponer recuentos
 * (no conoce el número de nodos descartados). El grafo sigue usable.
 */
const TRUNCATION_MESSAGE =
  'Hay más sesiones de las que se pudieron cargar; el grafo muestra solo una parte de la ejecución.';

export interface GraphTruncationBannerProps {
  /** Clases de posicionamiento que aporta el contenedor. */
  className?: string;
}

/**
 * Molecule del **aviso persistente de truncamiento** (feature 011, FR-006,
 * SC-009; `contracts/subtree-structure-contract.md` §5, `data-model.md` §7).
 *
 * Sirve tanto al corte del subárbol del grafo como al del listado de raíces.
 * Es informativo puro —sin acción ni cifras— porque no conoce el recuento, así
 * que no recibe props más allá del `className` de posicionamiento. Reutiliza el
 * `Alert` compartido con la variante `warning`: los estilos del aviso y el
 * icono salen de `alertVariants`/`ALERT_VARIANT_ICON`, sin duplicar clases.
 *
 * Accesibilidad: se anuncia como `role="status"` + `aria-live="polite"` (patrón
 * `ConnectionBadge`), **nunca** como `role="alert"` (lo ocupa el banner de
 * atención del chat) y sin re-anunciarse por tick. Presentacional: no conoce el
 * SDK ni los servicios.
 */
export const GraphTruncationBanner = ({
  className,
}: GraphTruncationBannerProps) => (
  <Alert
    variant="warning"
    role="status"
    ariaLive="polite"
    data-testid="graph-truncation-banner"
    title={TRUNCATION_TITLE}
    message={TRUNCATION_MESSAGE}
    className={className}
  />
);
