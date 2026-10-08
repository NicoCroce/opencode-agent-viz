import { Container } from '@app/Application/Components';

interface ResourceRowProps {
  /** Etiqueta de la fila (p. ej. "MCP", "Instructions", "Tools"). */
  label: string;
  /** Recursos disponibles; vacío → `emptyLabel`. */
  items: string[];
  /** Texto mostrado cuando no hay recursos. */
  emptyLabel: string;
}

/**
 * Fila `etiqueta + chips` de recursos (SH-15).
 *
 * Presentación pura: la etiqueta va en mayúsculas atenuadas y, debajo, los
 * recursos como chips monoespaciados marcados "disponible"; sin recursos, muestra
 * `emptyLabel`. Extraída del `ResourceRow` privado de `ResourceList` y
 * reutilizable por cualquier panel de recursos. No accede al SDK ni a hooks.
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
            key={item}
            className="rounded-flat border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
          >
            {item}
            <span className="ml-1 text-muted-foreground">disponible</span>
          </span>
        ))}
      </Container>
    )}
  </Container>
);
