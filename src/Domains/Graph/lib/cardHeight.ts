import type { TGraphNodeData } from '../Graph.entity';
import { MIN_NODE_HEIGHT } from './nodeResize';

/**
 * Métrica vertical del card de agente, en píxeles. Debe mantenerse alineada con
 * el markup de `AgentNode` (`py-2.5`, `text-xs leading-snug`, `text-[11px]`,
 * `mt-1`, `border-t pt-1.5`, `gap-1`).
 */
const PAD_Y = 20;
const TITLE_LINE = 17;
const BODY_LINE = 17;
const MODEL_GAP = 4;
const FOOTER_PAD = 7;
const FOOTER_GAP = 4;
/** Ancho base reservado al estado y al badge de paralelismo en el encabezado. */
const STATUS_BASE_WIDTH = 72;
/** Muescas del medidor de esfuerzo (contrato: escala de 5, effort-contract §5). */
const EFFORT_NOTCHES = 5;
/** Ancho de cada muesca del medidor (`w-1`). */
const EFFORT_NOTCH_WIDTH = 4;
/** Separación entre muescas del medidor (`gap-0.5`). */
const EFFORT_NOTCH_GAP = 2;
/** Separación entre el medidor y el resto del encabezado (`gap-1`). */
const HEADER_GAP = 4;
/**
 * Ancho del medidor de esfuerzo: 5 muescas más sus separaciones. Lo reserva
 * `STATUS_WIDTH` en la fila del encabezado (effort-contract §5; research R8).
 */
export const EFFORT_METER_WIDTH =
  EFFORT_NOTCHES * EFFORT_NOTCH_WIDTH +
  (EFFORT_NOTCHES - 1) * EFFORT_NOTCH_GAP;
/**
 * Ancho reservado en el encabezado al estado, al badge de paralelismo y al
 * medidor de esfuerzo. Al ir el medidor en la **misma fila** que el badge
 * (design-direction §6), la reserva crece para que el título no se recorte.
 */
export const STATUS_WIDTH = STATUS_BASE_WIDTH + EFFORT_METER_WIDTH + HEADER_GAP;
/** Ancho reservado al tag de variante del modelo. */
const VARIANT_WIDTH = 48;
/** Padding horizontal del card (`pl-3 pr-2.5`). */
const PAD_X = 22;
/** Ancho aproximado de un carácter en la tipografía de datos. */
const CHAR_WIDTH = 6.6;

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
 * las líneas del título (clampeado a 2), la línea de modelo (nombre + variante)
 * y las del pie (consumo, rango horario y herramienta en curso).
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

  // El pie suma, además del consumo y el rango horario, la herramienta en
  // curso y —cuando existen— el reintento (FR-018) y el motivo de interrupción
  // (FR-019), para que el card nunca los recorte.
  const footerLines =
    2 +
    (data.currentTool ? 1 : 0) +
    (data.retry ? 1 : 0) +
    (data.status === 'interrupted' ? 1 : 0);
  height += FOOTER_PAD + footerLines * BODY_LINE + (footerLines - 1) * FOOTER_GAP;

  return Math.max(MIN_NODE_HEIGHT, Math.round(height));
};
