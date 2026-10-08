/**
 * Reloj compacto `HH:mm` (24h, hora local), determinista y sin depender del
 * locale. Unifica el `formatClock` privado de `formatTimeRange.ts` (variante
 * vía `toLocaleTimeString`, sujeta al locale) y la reimplementación de
 * `AgentNode.tsx` (variante manual `pad(h|m)`, la que se adopta aquí por ser la
 * única que garantiza el formato `HH:mm`).
 */
export const formatClock = (ms: number): string => {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
