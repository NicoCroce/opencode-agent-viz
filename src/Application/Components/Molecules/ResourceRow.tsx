import { Container } from '@app/Application/Components';

interface ResourceRowProps {
  /** Etiqueta de la fila (p. ej. "MCP", "Instructions", "Tools"). */
  label: string;
  /**
   * Recursos listados; vacío → `emptyLabel`. Con `note` la fila pinta
   * `label · note` (p. ej. `frontend-design · ~3.4k tokens`) y **sin** el chip
   * "disponible", porque el recurso ya entró al contexto.
   */
  items: { label: string; note?: string }[];
  /** Texto mostrado cuando no hay recursos. */
  emptyLabel: string;
}

/**
 * Fila `etiqueta + chips` de recursos (SH-15).
 *
 * Presentación pura: la etiqueta va en mayúsculas atenuadas y, debajo, los
 * recursos como chips monoespaciados; sin `note` se marcan "disponible"
 * (MCP/Instructions/Tools) y con `note` muestran `label · note` con el valor en
 * `tabular-nums` y el `aria-label` deletreando que la estimación es aproximada
 * (FR-010). Sin recursos, muestra `emptyLabel`. Extraída de `ResourceRow`
 * privado de `ResourceList` y reutilizable por cualquier panel de recursos. No
 * accede al SDK ni a hooks.
 */
export const ResourceRow = ({ label, items, emptyLabel }: ResourceRowProps) => (
  <Container space="small">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {items.length === 0 ? (
      <span className="text-[11px] text-muted-foreground">{emptyLabel}</span>
    ) : (
      <Container row space="small" className="flex-wrap">
        {items.map((item) => (
          <span
            key={item.label}
            className="rounded-flat border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
          >
            {item.label}
            {item.note === undefined ? (
              <span className="ml-1 text-muted-foreground">disponible</span>
            ) : (
              <>
                <span aria-hidden="true" className="mx-1 text-muted-foreground">
                  ·
                </span>
                <span
                  aria-label={`Aproximadamente ${item.note}`}
                  className="tabular-nums text-muted-foreground"
                >
                  {item.note}
                </span>
              </>
            )}
          </span>
        ))}
      </Container>
    )}
  </Container>
);
