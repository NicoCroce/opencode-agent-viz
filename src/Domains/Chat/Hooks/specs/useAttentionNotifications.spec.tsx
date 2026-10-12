import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import type { TAttentionItem } from '../../Chat.entity';
import {
  ATTENTION_TOAST_ACTION_LABEL,
  useAttentionNotifications,
} from '../useAttentionNotifications';

/**
 * Specs del aviso efímero accesible de atención (feature 009, T046 · A5).
 *
 * Contrato `attention-contract.md §2` (A5): al aparecer un pendiente **nuevo**
 * se dispara un toast de `sonner` (live region ya montada en `App.tsx`) con una
 * acción que lleva a la request origen; el hook **deduplica por `item.id`**, así
 * que el mismo pendiente no se re-notifica. El anuncio sale de la lista derivada
 * (`TAttentionItem[]`), **nunca** de un delta de stream. `sonner` se mockea para
 * observar las llamadas sin montar el `Toaster` (eso es T065).
 */

vi.mock('sonner', () => ({ toast: vi.fn() }));

const toastMock = vi.mocked(toast);

interface TToastOptions {
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** Lectura tipada de la n-ésima llamada a `toast` (evita `any` en el spec). */
const callAt = (index: number): { message: unknown; options: TToastOptions } => {
  const call = toastMock.mock.calls[index] ?? [];
  return {
    message: call[0],
    options: (call[1] ?? {}) as TToastOptions,
  };
};

const makeItem = (overrides: Partial<TAttentionItem> = {}): TAttentionItem => ({
  id: 'perm_1',
  kind: 'permission',
  sessionId: 'ses_root',
  nodeId: 'node_1',
  title: 'bash: rm -rf /',
  at: 1_000,
  ...overrides,
});

describe('useAttentionNotifications — pendiente nuevo (A5)', () => {
  it('no notifica cuando no hay pendientes', () => {
    renderHook(() => useAttentionNotifications([]));

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('dispara un toast accesible por cada pendiente nuevo', () => {
    const first = makeItem({ id: 'perm_1', title: 'Permiso A' });
    const second = makeItem({
      id: 'form_1',
      kind: 'question',
      title: '¿Continuar?',
    });

    renderHook(() => useAttentionNotifications([first, second]));

    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(callAt(0).message).toBe('Permiso A');
    expect(callAt(0).options.action?.label).toBe(
      ATTENTION_TOAST_ACTION_LABEL,
    );
    expect(callAt(1).message).toBe('¿Continuar?');
    expect(callAt(1).options.action?.label).toBe(
      ATTENTION_TOAST_ACTION_LABEL,
    );
  });
});

describe('useAttentionNotifications — dedupe por id (A5)', () => {
  it('no re-notifica el mismo pendiente al re-renderizar con los mismos items', () => {
    const item = makeItem();

    const { rerender } = renderHook(
      ({ items }: { items: TAttentionItem[] }) =>
        useAttentionNotifications(items),
      { initialProps: { items: [item] } },
    );

    rerender({ items: [item] });
    rerender({ items: [{ ...item }] });

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it('notifica solo el pendiente nuevo al agregar uno a la lista existente', () => {
    const existing = makeItem({ id: 'perm_1', title: 'Permiso A' });
    const added = makeItem({ id: 'perm_2', title: 'Permiso B' });

    const { rerender } = renderHook(
      ({ items }: { items: TAttentionItem[] }) =>
        useAttentionNotifications(items),
      { initialProps: { items: [existing] } },
    );

    rerender({ items: [existing, added] });

    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(callAt(1).message).toBe('Permiso B');
  });

  it('no vuelve a notificar un id que desaparece y reaparece', () => {
    const item = makeItem();

    const { rerender } = renderHook(
      ({ items }: { items: TAttentionItem[] }) =>
        useAttentionNotifications(items),
      { initialProps: { items: [item] } },
    );

    rerender({ items: [] });
    rerender({ items: [item] });

    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});

describe('useAttentionNotifications — navegación a la request origen (FR-010)', () => {
  it('la acción del toast navega a la request origen (sesión hija incluida)', () => {
    const onNavigate = vi.fn();
    const childItem = makeItem({
      id: 'perm_hija',
      sessionId: 'ses_child',
      nodeId: null,
    });

    renderHook(() => useAttentionNotifications([childItem], onNavigate));

    callAt(0).options.action?.onClick();

    expect(onNavigate).toHaveBeenCalledWith(childItem);
    const origin = onNavigate.mock.calls[0]?.[0] as TAttentionItem;
    expect(origin.sessionId).toBe('ses_child');
  });

  it('no rompe cuando no se aporta manejador de navegación', () => {
    const item = makeItem();

    renderHook(() => useAttentionNotifications([item]));

    expect(() => callAt(0).options.action?.onClick()).not.toThrow();
  });
});
