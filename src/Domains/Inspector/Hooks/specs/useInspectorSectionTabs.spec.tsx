import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  INSPECTOR_SECTION_TAB_ID,
  INSPECTOR_SECTION_TAB_ITEMS,
  INSPECTOR_SECTION_TABS,
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
  isInspectorSectionTab,
  useInspectorSectionTabs,
  type TInspectorSectionTab,
} from '../useInspectorSectionTabs';

/**
 * `useInspectorSectionTabs` es la única fuente de lógica del tablist interno de
 * secciones técnicas del detalle del nodo (FR-001/FR-003/FR-005/FR-013). Orden
 * literal del contrato `inspector-section-tabs-contract.md` §1 y §3:
 * Subagentes · Archivos · Herramientas · Respuestas · Preguntas y permisos ·
 * Errores · Latencia.
 */

/** Etiquetas del tablist externo, literales en `InspectorPane` (FR-013). */
const EXTERNAL_DETAIL_TABS_ARIA_LABEL = 'Vistas del panel de detalle';

/** Los siete ids del tablist, en el orden exacto de FR-001. */
const SECTION_TAB_IDS: readonly TInspectorSectionTab[] = [
  'subagents',
  'files',
  'tools',
  'answers',
  'questions',
  'errors',
  'latency',
];

/** Las siete etiquetas literales, sin renombrar (FR-005). */
const SECTION_TAB_LABELS = [
  'Subagentes',
  'Archivos',
  'Herramientas',
  'Respuestas',
  'Preguntas y permisos',
  'Errores',
  'Latencia',
];

describe('useInspectorSectionTabs — pestaña activa (FR-003)', () => {
  it('arranca en la pestaña Subagentes', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    expect(result.current.tab).toBe(INSPECTOR_SECTION_TAB_ID);
    expect(result.current.tab).toBe('subagents');
  });

  it('permite elegir la pestaña inicial', () => {
    const { result } = renderHook(() => useInspectorSectionTabs('latency'));

    expect(result.current.tab).toBe('latency');
  });

  it('cambia la pestaña activa con setTab', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    act(() => {
      result.current.setTab('questions');
    });

    expect(result.current.tab).toBe('questions');
  });

  it('ignora valores que no son secciones válidas', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    act(() => {
      result.current.setTab('nope' as TInspectorSectionTab);
    });

    expect(result.current.tab).toBe(INSPECTOR_SECTION_TAB_ID);
  });

  it('ignora un id inválido sin perder la sección ya elegida', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    act(() => {
      result.current.setTab('files');
    });
    act(() => {
      result.current.setTab('' as TInspectorSectionTab);
    });

    expect(result.current.tab).toBe('files');
  });

  it('mantiene la selección entre renders: el estado es efímero, no derivado de datos', () => {
    const { result, rerender } = renderHook(() => useInspectorSectionTabs());

    act(() => {
      result.current.setTab('errors');
    });
    rerender();

    expect(result.current.tab).toBe('errors');
  });

  it('no vuelve a la pestaña inicial al re-renderizar con otra prop', () => {
    const { result, rerender } = renderHook(
      ({ initialTab }: { initialTab: TInspectorSectionTab }) =>
        useInspectorSectionTabs(initialTab),
      { initialProps: { initialTab: 'errors' as TInspectorSectionTab } },
    );

    act(() => {
      result.current.setTab('tools');
    });
    rerender({ initialTab: 'latency' });

    expect(result.current.tab).toBe('tools');
  });
});

describe('useInspectorSectionTabs — tablist de siete secciones (FR-001/FR-005)', () => {
  it('expone las siete secciones en el orden exacto', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    expect(result.current.tabs.map((item) => item.id)).toEqual([
      ...SECTION_TAB_IDS,
    ]);
  });

  it('expone las siete etiquetas literales, sin renombrar', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    expect(result.current.tabs.map((item) => item.label)).toEqual(
      SECTION_TAB_LABELS,
    );
  });

  it('la constante INSPECTOR_SECTION_TABS fija el orden de los ids', () => {
    expect(INSPECTOR_SECTION_TABS).toEqual([...SECTION_TAB_IDS]);
  });

  it('los items del tablist son la constante centralizada', () => {
    const { result } = renderHook(() => useInspectorSectionTabs());

    expect(result.current.tabs).toBe(INSPECTOR_SECTION_TAB_ITEMS);
    expect(result.current.tabs).toHaveLength(7);
  });

  it('mantiene tabs referencialmente estable entre renders', () => {
    const { result, rerender } = renderHook(() => useInspectorSectionTabs());
    const firstTabs = result.current.tabs;

    act(() => {
      result.current.setTab('answers');
    });
    rerender();

    expect(result.current.tabs).toBe(firstTabs);
  });
});

describe('INSPECTOR_SECTION_TABS_ARIA_LABEL (FR-013)', () => {
  it('nombra el tablist interno de secciones técnicas', () => {
    expect(INSPECTOR_SECTION_TABS_ARIA_LABEL).toBe(
      'Secciones técnicas del nodo',
    );
  });

  it('es distinto del aria-label del tablist externo', () => {
    expect(INSPECTOR_SECTION_TABS_ARIA_LABEL).not.toBe(
      EXTERNAL_DETAIL_TABS_ARIA_LABEL,
    );
  });
});

describe('isInspectorSectionTab — guarda de tipo', () => {
  it('reconoce las siete secciones válidas', () => {
    for (const id of SECTION_TAB_IDS) {
      expect(isInspectorSectionTab(id)).toBe(true);
    }
  });

  it('rechaza cualquier otro valor', () => {
    expect(isInspectorSectionTab('')).toBe(false);
    expect(isInspectorSectionTab('detail')).toBe(false);
    expect(isInspectorSectionTab('Subagentes')).toBe(false);
    expect(isInspectorSectionTab('subagent')).toBe(false);
  });
});
