import { UNAVAILABLE_LABEL } from '@app/Application/Helpers/format/constants';
import type { TTurnAnalysis } from '../Efficiency.entity';

/**
 * Copy y etiquetas de presentación del dominio Efficiency.
 *
 * Módulo puro: no importa React, el SDK ni servicios. Las etiquetas viven aquí
 * para que el motor y la UI compartan el mismo vocabulario y no aparezcan
 * cadenas sueltas en los componentes (FR-007, FR-027).
 */

/** Nombres visibles de las cuatro dimensiones de la puntuación. */
export const DIMENSION_LABEL = {
  entrada: 'Entrada',
  ejecucion: 'Ejecución',
  contexto: 'Contexto',
  resultado: 'Resultado',
} as const;

/**
 * Bandas del veredicto. Se mantienen en minúscula porque se interpolan en
 * frases y en el `aria-label` "N de 100, banda" (FR-041).
 */
export const BAND_LABEL = {
  eficiente: 'eficiente',
  aceptable: 'aceptable',
  mejorable: 'mejorable',
  friccion: 'fricción',
} as const;

/**
 * Nivel de confianza del informe (§4.6). Se interpola como
 * "confianza {alta|media|baja}", por eso el valor va en minúscula.
 */
export const CONFIDENCE_LABEL = {
  alta: 'alta',
  media: 'media',
  baja: 'baja',
} as const;

/**
 * Severidad de un hallazgo (FR-023). Se interpola como
 * "severidad {alta|media|baja}", por eso el valor va en minúscula.
 */
export const SEVERITY_LABEL = {
  alta: 'alta',
  media: 'media',
  baja: 'baja',
} as const;

/** Estado del informe; `ok` es el único que produce nota. */
export const STATUS_LABEL = {
  ok: 'Correcto',
  in_progress: 'En curso',
  insufficient: 'Muestra insuficiente',
  no_data: 'Sin datos',
} as const;

/** Nombres cortos de los indicadores que explican la puntuación. */
export const INDICATOR_LABEL = {
  'INP-1': 'Pedidos consecutivos similares',
  'INP-2': 'Interrupciones',
  'INP-3': 'Preguntas repetidas',
  'RES-1': 'Errores de herramientas',
  'RES-2': 'Reintentos',
  'RES-3': 'Llamadas redundantes',
  'RES-4': 'Compactaciones automáticas',
  CACHE: 'Aprovechamiento de caché',
  OUTCOME: 'Resultado final',
  OPEN_ERRORS: 'Errores abiertos',
} as const;

/**
 * Copy neutral de la UI (FR-027): describe señales y ausencias sin atribuir
 * culpa ni valorar a la persona. "no disponible" reutiliza la constante
 * compartida para que no existan dos textos para el mismo estado (FR-018).
 */
export const NEUTRAL_COPY = {
  possibleFriction: 'posible fricción',
  signal: 'señal',
  unavailable: UNAVAILABLE_LABEL,
} as const;

/**
 * Resultado final de un turno (`TTurnAnalysis['outcome']` sin `null`). Fuente
 * única para la tabla y las tarjetas de turnos (FR-007/FR-034).
 */
export const OUTCOME_LABEL: Record<
  NonNullable<TTurnAnalysis['outcome']>,
  string
> = {
  succeeded: 'Éxito',
  failed: 'Fallo',
  interrupted: 'Interrumpido',
};

/**
 * Copy común de las dos presentaciones de turnos (tabla y tarjetas), para que
 * no diverjan ni queden cadenas sueltas en los componentes (FR-007).
 */
export const TURN_LABEL = {
  turn: 'Turno',
  prompt: 'Pedido',
  clarifications: 'Aclaraciones',
  outcome: 'Resultado',
  cost: 'Coste',
  time: 'Tiempo',
  signals: 'Señales',
  open: 'abierto',
  expand: 'Ver detalle',
  collapse: 'Ocultar detalle',
  empty: 'Sin turnos',
  noSignals: 'sin señales',
  unavailableCost: 'coste no disponible',
  unavailableTime: 'tiempo no disponible',
  unavailableOutcome: 'resultado no disponible',
} as const;
