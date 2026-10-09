import type { TGraphNodeData } from '../Graph.entity';
import { MIN_NODE_HEIGHT } from './nodeResize';

/**
 * Métrica vertical del card de agente, en píxeles. Debe mantenerse alineada con
 * el markup de `AgentNode` (`py-2.5`, `text-xs leading-snug`, `text-[11px]`,
 * `mt-1`, `border-t pt-1.5`, `gap-1`, banda de esfuerzo).
 */
const PAD_Y = 20;
const TITLE_LINE = 17;
const BODY_LINE = 17;
const MODEL_GAP = 4;
const FOOTER_PAD = 7;
const FOOTER_GAP = 4;
/** Ancho base reservado al estado y al badge de paralelismo en el encabezado. */
const STATUS_BASE_WIDTH = 72;
/** Punto de estado del cluster meta del encabezado (`size-1.5` + `gap-1.5`). */
const STATUS_DOT_WIDTH = 12;
/**
 * Ancho reservado en el encabezado al **cluster meta**: punto de estado + badge
 * de paralelismo + etiqueta de estado. El medidor de esfuerzo no va aquí (vive
 * en su banda al pie), así que no suma a esta reserva.
 */
export const STATUS_WIDTH = STATUS_BASE_WIDTH + STATUS_DOT_WIDTH;
/** Ancho reservado al tag de variante del modelo. */
const VARIANT_WIDTH = 48;
/** Padding horizontal del card (`pl-3 pr-2.5`). */
const PAD_X = 22;
/** Ancho aproximado de un carácter en la tipografía de datos. */
const CHAR_WIDTH = 6.6;
/** Padding superior de la banda de esfuerzo (`border-t pt-1.5`). */
const EFFORT_BAND_PAD = 7;
/** Alto de la banda de esfuerzo (etiqueta + barra + nivel). */
const EFFORT_BAND_HEIGHT = 12;

const estimatedLines = (
  text: string,
  available: number,
  maxLines: number,
): number =>
  Math.min(
    maxLines,
    Math.max(1, Math.ceil((text.length * CHAR_WIDTH) / Math.max(available, 1))),
  );

/**
 * Alto del card de un agente **según su contenido**, sin medir el DOM: estima
 * las líneas del título (clampeado a 2), la línea de modelo (nombre + variante),
 * las del pie (consumo + contexto) y, cuando hay esfuerzo, su banda al pie.
 *
 * Función pura y determinística (Principio V): los carriles de ejecución usan
 * este alto para dimensionar cada fila, así el nodo no se recorta y la fila
 * crece con el contenido.
 */
export const cardHeight = (data: TGraphNodeData, width: number): number => {
  const inner = Math.max(width - PAD_X, 1);
  const title = data.title ?? data.agentName;
  const titleLines = estimatedLines(title, inner - STATUS_WIDTH, 2);

  let height = PAD_Y + titleLines * TITLE_LINE;

  if (data.model) {
    const modelText = `${data.model.providerID}/${data.model.id}`;
    const modelLines = estimatedLines(
      modelText,
      inner - (data.model.variant ? VARIANT_WIDTH : 0),
      6,
    );
    height += MODEL_GAP + modelLines * BODY_LINE;
  }

  // El pie suma el consumo (vitals) y el contexto (hora + herramienta), más una
  // línea propia cuando hay reintento (FR-018) o motivo de interrupción (FR-019).
  const footerLines =
    2 + (data.retry ? 1 : 0) + (data.status === 'interrupted' ? 1 : 0);
  height += FOOTER_PAD + footerLines * BODY_LINE + (footerLines - 1) * FOOTER_GAP;

  // La banda de esfuerzo se apila al pie, sobre su propio borde superior.
  if (data.effort) {
    height += EFFORT_BAND_PAD + EFFORT_BAND_HEIGHT;
  }

  return Math.max(MIN_NODE_HEIGHT, Math.round(height));
};
