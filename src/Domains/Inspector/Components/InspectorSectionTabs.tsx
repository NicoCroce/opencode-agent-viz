import type { ReactNode } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/Application/Components';
import {
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
  INSPECTOR_SECTION_TABS_LIST_CLASSNAME,
  isInspectorSectionTab,
  useInspectorSectionTabs,
  type TInspectorSectionTab,
} from '../Hooks/useInspectorSectionTabs';

/**
 * Tablist de las siete secciones técnicas del detalle del nodo (FR-001/FR-002,
 * `contracts/inspector-section-tabs-contract.md` §1-§3).
 *
 * Es **presentación pura** (Principio II): no conoce datos del dominio ni hace
 * fetching. La única lógica (ids, orden, etiquetas, guarda y estado de la
 * pestaña activa) sale del hook `useInspectorSectionTabs`; las secciones llegan
 * ya construidas por `InspectorPanel` en un `Record` **exhaustivo por tipo**
 * (añadir una pestaña obliga a aportar su sección). El estado es efímero y no
 * se persiste: al desmontar el componente (cierre del detalle) vuelve a
 * `subagents` por el límite de montaje de React (FR-003, R1).
 *
 * Los `id` y el ARIA (`role`, `aria-controls`, `aria-selected`) los genera
 * Radix con `useId`; aquí **no** se pasan manualmente (§2).
 */

/** Valor de `data-testid` del tablist interno (referencia estable para specs). */
export const INSPECTOR_SECTION_TABS_TEST_ID = 'inspector-section-tabs';

/** Valor de `data-testid` de cada `tabpanel` del tablist interno. */
export const INSPECTOR_SECTION_PANEL_TEST_ID = 'inspector-section-panel';

/**
 * Clases del `TabsContent` del call site: `min-w-0` (no desborda en columnas
 * estrechas), `cursor-default` (el primitivo trae `cursor-pointer`, incorrecto
 * sobre contenido de panel; `twMerge` lo resuelve sin `!`) y `mt-3`. **Sin**
 * utilidades de `display`: anularían `[hidden]` y expondrían los siete paneles
 * (contract §2/§3, 1.3.1 / 2.4.3).
 */
export const INSPECTOR_SECTION_PANEL_CLASSNAME = 'min-w-0 cursor-default mt-3';

export interface InspectorSectionTabsProps {
  /** Una entrada por pestaña (Record exhaustivo por tipo). */
  sections: Record<TInspectorSectionTab, ReactNode>;
}

export const InspectorSectionTabs = ({
  sections,
}: InspectorSectionTabsProps) => {
  const { tab, setTab, tabs } = useInspectorSectionTabs();

  // Radix entrega el `value` como `string`; se valida antes de fijar el tab
  // para que un valor inesperado no deje el tablist sin pestaña activa.
  const handleValueChange = (value: string) => {
    if (isInspectorSectionTab(value)) setTab(value);
  };

  return (
    <Tabs value={tab} onValueChange={handleValueChange}>
      <TabsList
        aria-label={INSPECTOR_SECTION_TABS_ARIA_LABEL}
        className={INSPECTOR_SECTION_TABS_LIST_CLASSNAME}
        data-testid={INSPECTOR_SECTION_TABS_TEST_ID}
      >
        {tabs.map((item) => (
          <TabsTrigger key={item.id} value={item.id}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((item) => (
        <TabsContent
          key={item.id}
          value={item.id}
          className={INSPECTOR_SECTION_PANEL_CLASSNAME}
          data-testid={INSPECTOR_SECTION_PANEL_TEST_ID}
        >
          {sections[item.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
};
