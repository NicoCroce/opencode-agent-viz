/** Etiqueta del indicador; misma que `InProgressText` (hover, no accesible). */
export const TYPING_INDICATOR_TITLE = 'En curso';

/**
 * Indicador animado de "en curso" del chat (FR-004): tres puntos que pulsan en
 * escalera con el token `--status-running`, en lugar del literal "En curso".
 *
 * Presentación pura y `aria-hidden`: el anuncio accesible del turno lo aporta el
 * `role="status"` de `ChatTimeline`, así que aquí solo se añade el gesto visual
 * (`title` únicamente para el hover). El **estado base** de cada punto es
 * opacidad plena (ver `.chat-typing-dot` en `index.css`), de modo que sin
 * animación —p. ej. cuando `prefers-reduced-motion` neutraliza las animaciones
 * globalmente— los tres puntos siguen visibles y estáticos, nunca en blanco.
 *
 * No se reutiliza `InProgressText`: es compartido con el Historial y el grafo,
 * que siguen mostrando el texto.
 */
export const ChatTypingIndicator = () => (
  <span
    aria-hidden="true"
    title={TYPING_INDICATOR_TITLE}
    data-testid="chat-typing-indicator"
    className="inline-flex items-center gap-1 text-status-running"
  >
    <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-current" />
    <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-current" />
    <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-current" />
  </span>
);
