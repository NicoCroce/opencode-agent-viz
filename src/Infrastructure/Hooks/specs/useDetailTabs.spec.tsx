import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  CHAT_TAB_ID,
  DETAIL_TAB_ID,
  DETAIL_TAB_ITEMS,
  DETAIL_TABS,
  isDetailTab,
  useDetailTabs,
  type TDetailTab,
} from '../useDetailTabs';

/**
 * `useDetailTabs` es la única fuente de lógica del tab activo y del tablist
 * `Detalle | Chat` (FR-014). Alimenta el tablist Radix de `InspectorPane`
 * (escritorio) y, en móvil, se reusa su definición sin montar el tablist
 * (FR-013). El estado es efímero: no se persiste.
 */
describe('useDetailTabs — estado del tab activo (FR-014)', () => {
  it('arranca en la pestaña Detalle', () => {
    const { result } = renderHook(() => useDetailTabs());

    expect(result.current.tab).toBe(DETAIL_TAB_ID);
    expect(result.current.tab).toBe('detail');
  });

  it('permite elegir la pestaña inicial', () => {
    const { result } = renderHook(() => useDetailTabs(CHAT_TAB_ID));

    expect(result.current.tab).toBe('chat');
  });

  it('cambia la pestaña activa con setTab', () => {
    const { result } = renderHook(() => useDetailTabs());

    act(() => {
      result.current.setTab('chat');
    });

    expect(result.current.tab).toBe('chat');
  });

  it('ignora valores que no son pestañas válidas', () => {
    const { result } = renderHook(() => useDetailTabs());

    act(() => {
      result.current.setTab('nope' as TDetailTab);
    });

    expect(result.current.tab).toBe(DETAIL_TAB_ID);
  });
});

describe('useDetailTabs — tablist Detalle | Chat (FR-014)', () => {
  it('expone el orden y las etiquetas del tablist', () => {
    const { result } = renderHook(() => useDetailTabs());

    expect(result.current.tabs).toBe(DETAIL_TAB_ITEMS);
    expect(result.current.tabs.map((item) => item.id)).toEqual([
      'detail',
      'chat',
    ]);
    expect(result.current.tabs.map((item) => item.label)).toEqual([
      'Detalle',
      'Chat',
    ]);
  });

  it('la constante DETAIL_TABS fija el orden de las pestañas', () => {
    expect(DETAIL_TABS).toEqual(['detail', 'chat']);
  });
});

describe('isDetailTab — guarda de tipo', () => {
  it('reconoce las pestañas válidas', () => {
    expect(isDetailTab('detail')).toBe(true);
    expect(isDetailTab('chat')).toBe(true);
  });

  it('rechaza cualquier otro valor', () => {
    expect(isDetailTab('inspector')).toBe(false);
    expect(isDetailTab('')).toBe(false);
  });
});
