interface NavButtonProps {
  /** Identificador de la sesión destino; también es el texto visible. */
  sessionId: string;
  /** Navega a la sesión sin recargar el overlay (FR-012). */
  onNavigate: (sessionId: string) => void;
  /** Tooltip del chip; por defecto, el propio `sessionId`. */
  title?: string;
}

/**
 * Chip monoespaciado de navegación de linaje (FR-012).
 *
 * Presentación pura: plano, truncado y sin caja pesada, para encajar en la
 * cabecera fija del overlay del histórico. Extraído del `NavButton` privado de
 * `HistoryHeader`; reutilizable por `HistoryModal` y futuras listas de linaje.
 * No accede al SDK ni a hooks.
 */
export const NavButton = ({ sessionId, onNavigate, title }: NavButtonProps) => (
  <button
    type="button"
    onClick={() => onNavigate(sessionId)}
    title={title ?? sessionId}
    className="max-w-[16rem] truncate rounded-flat border border-border px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent focus-visible:outline-none"
  >
    {sessionId}
  </button>
);
