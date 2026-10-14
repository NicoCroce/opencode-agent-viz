import { useCallback, useState } from 'react';

/**
 * Definición única del tablist de secciones técnicas del detalle del nodo.
 * Es la **única fuente de lógica** de los ids, el orden, las etiquetas, la
 * guarda y el estado de la pestaña activa; el componente
 * `InspectorSectionTabs` solo la consume (Principio V: lógica pura y testeable
 * fuera del componente).
 *
 * El estado es **efímero** (en memoria): no se persiste ni se deriva de los
 * datos del nodo. El reinicio a `subagents` al cerrar y reabrir el detalle lo
 * resuelve el límite de montaje del componente (FR-003), no un efecto.
 */

/** Identificador de la pestaña activa por defecto (FR-003). */
export const INSPECTOR_SECTION_TAB_ID = 'subagents' as const;

/** Orden exacto de las pestañas de secciones (FR-001). */
export const INSPECTOR_SECTION_TABS = [
  INSPECTOR_SECTION_TAB_ID,
  'files',
  'tools',
  'answers',
  'questions',
  'errors',
  'latency',
] as const;

export type TInspectorSectionTab = (typeof INSPECTOR_SECTION_TABS)[number];

export interface TInspectorSectionTabItem {
  id: TInspectorSectionTab;
  label: string;
}

/**
 * Etiquetas literales del tablist (FR-005: sin renombrar). Se centralizan aquí
 * para evitar magic strings repetidos en el componente y en los specs
 * (AGENTS §8.5).
 */
export const INSPECTOR_SECTION_TAB_ITEMS: readonly TInspectorSectionTabItem[] =
  [
    { id: 'subagents', label: 'Subagentes' },
    { id: 'files', label: 'Archivos' },
    { id: 'tools', label: 'Herramientas' },
    { id: 'answers', label: 'Respuestas' },
    { id: 'questions', label: 'Preguntas y permisos' },
    { id: 'errors', label: 'Errores' },
    { id: 'latency', label: 'Latencia' },
  ];

/**
 * Etiqueta del tablist interno. **Distinta** de la del tablist externo
 * (`Vistas del panel de detalle`) para que ambos sean identificables (FR-013).
 */
export const INSPECTOR_SECTION_TABS_ARIA_LABEL = 'Secciones técnicas del nodo';

/**
 * Clases del tablist de secciones en el call site (ancho completo y alineado a
 * la izquierda). No duplica el override de alto del primitivo `ui/tabs.tsx`.
 */
export const INSPECTOR_SECTION_TABS_LIST_CLASSNAME =
  'w-full justify-start gap-1';

/** Guarda de tipo: valida un valor arbitrario (p. ej. el `value` de Radix). */
export const isInspectorSectionTab = (
  value: string,
): value is TInspectorSectionTab =>
  (INSPECTOR_SECTION_TABS as readonly string[]).includes(value);

export interface TUseInspectorSectionTabsResult {
  /** Pestaña activa. */
  tab: TInspectorSectionTab;
  /** Cambia la pestaña activa (ignora valores fuera de `INSPECTOR_SECTION_TABS`). */
  setTab: (tab: TInspectorSectionTab) => void;
  /** Definición del tablist (id + etiqueta) en orden. */
  tabs: readonly TInspectorSectionTabItem[];
}

/**
 * Estado de vista de la pestaña activa del detalle del nodo. El estado es
 * efímero (en memoria): no hay preferencia persistida. `setTab` acepta solo ids
 * válidos para que un `value` inesperado de Radix no deje el panel sin pestaña
 * activa y la selección no dependa de los datos del nodo (FR-003).
 */
export const useInspectorSectionTabs = (
  initialTab: TInspectorSectionTab = INSPECTOR_SECTION_TAB_ID,
): TUseInspectorSectionTabsResult => {
  const [tab, setTabState] = useState<TInspectorSectionTab>(initialTab);

  const setTab = useCallback((next: TInspectorSectionTab) => {
    if (!isInspectorSectionTab(next)) return;
    setTabState(next);
  }, []);

  return { tab, setTab, tabs: INSPECTOR_SECTION_TAB_ITEMS };
};
