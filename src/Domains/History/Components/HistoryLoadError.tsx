/**
 * Aviso de que una página anterior falló y puede faltar contenido (FR-016).
 * No se presenta como el final de la sesión.
 */
export const HistoryLoadError = () => (
  <p
    role="alert"
    className="rounded-flat border border-status-error px-2 py-1 text-xs text-status-error"
  >
    No se pudo cargar más actividad; puede faltar contenido.
  </p>
);
