import { UNAVAILABLE } from './format/constants';

/**
 * Serializa la entrada cruda de una herramienta para mostrarla (FR-004).
 *
 * Extraído de `ToolCallEntry.formatInput` (DC-28) como función pura y
 * reutilizable por `Inspector/ToolHistory`. La serialización es defensiva: los
 * `null`/`undefined` y las entradas no serializables (referencias circulares)
 * caen al marcador `UNAVAILABLE` en lugar de romper el render.
 */
export const formatToolInput = (input: unknown): string => {
  if (input === null || input === undefined) return UNAVAILABLE;
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2) ?? UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
};
