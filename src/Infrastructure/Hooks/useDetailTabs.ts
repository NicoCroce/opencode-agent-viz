import { useCallback, useState } from 'react';

/**
 * Pestañas internas de la columna del detalle (FR-014). Es la **única fuente de
 * lógica** del tab activo (`detail | chat`) y de la definición del tablist
 * `Detalle | Chat`; las presentaciones (escritorio y móvil) solo la consumen.
 *
 * En escritorio alimenta el tablist Radix de `InspectorPane`; en móvil el chat
 * es un destino de primer nivel y **no** se monta este tablist (FR-013), pero la
 * misma definición (`DETAIL_TAB_ITEMS`) evita duplicar etiquetas.
 */

/** Identificador de la pestaña del detalle (panel actual del inspector). */
export const DETAIL_TAB_ID = 'detail' as const;

/** Identificador de la pestaña del chat. */
export const CHAT_TAB_ID = 'chat' as const;

/** Orden de las pestañas del detalle; la primera es la activa por defecto. */
export const DETAIL_TABS = [DETAIL_TAB_ID, CHAT_TAB_ID] as const;

export type TDetailTab = (typeof DETAIL_TABS)[number];

export interface TDetailTabItem {
  id: TDetailTab;
  label: string;
}

/**
 * Etiquetas del tablist `Detalle | Chat`. Se centralizan aquí para evitar magic
 * strings repetidos en el componente y en los specs (AGENTS §8.5).
 */
export const DETAIL_TAB_ITEMS: readonly TDetailTabItem[] = [
  { id: DETAIL_TAB_ID, label: 'Detalle' },
  { id: CHAT_TAB_ID, label: 'Chat' },
];

/** Guarda de tipo: valida un valor arbitrario (p. ej. el `value` de Radix). */
export const isDetailTab = (value: string): value is TDetailTab =>
  (DETAIL_TABS as readonly string[]).includes(value);

export interface TUseDetailTabsResult {
  /** Pestaña activa. */
  tab: TDetailTab;
  /** Cambia la pestaña activa (ignora valores fuera de `DETAIL_TABS`). */
  setTab: (tab: TDetailTab) => void;
  /** Definición del tablist (id + etiqueta) en orden. */
  tabs: readonly TDetailTabItem[];
}

/**
 * Estado de vista del tab activo de la columna del detalle. El estado es
 * efímero (en memoria): no hay preferencia persistida de pestaña. `setTab`
 * acepta solo ids válidos para que un `value` inesperado de Radix no deje el
 * panel sin tablist activo.
 */
export const useDetailTabs = (
  initialTab: TDetailTab = DETAIL_TAB_ID,
): TUseDetailTabsResult => {
  const [tab, setTabState] = useState<TDetailTab>(initialTab);

  const setTab = useCallback((next: TDetailTab) => {
    if (!isDetailTab(next)) return;
    setTabState(next);
  }, []);

  return { tab, setTab, tabs: DETAIL_TAB_ITEMS };
};
