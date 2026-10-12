import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@app/test/renderWithProviders';
import type { TAttentionItem } from '@app/Domains/Chat/Chat.entity';
import {
  ChatAttentionBanner,
  type ChatAttentionBannerProps,
} from '../ChatAttentionBanner';

/**
 * Specs de la molecule `ChatAttentionBanner` (feature 009, T051, FR-009, FR-010,
 * FR-011 · A4; `contracts/attention-contract.md` §2 y §3).
 *
 * El banner resume el pendiente y ofrece una acción que lleva a la request que
 * lo generó (aunque sea de una sesión hija). Es presentacional: sin pendientes
 * no renderiza nada; con ≥1 ítem muestra el resumen accesible y, al accionar,
 * emite `onGoToRequest` con el ítem más antiguo.
 */

const permission: TAttentionItem = {
  id: 'per_1',
  kind: 'permission',
  sessionId: 'ses_child',
  nodeId: 'node_child',
  title: 'bash',
  at: 1_000,
};

const question: TAttentionItem = {
  id: 'form_1',
  kind: 'question',
  sessionId: 'ses_child',
  nodeId: 'node_child',
  title: '¿Confirmas el despliegue?',
  at: 2_000,
};

const renderBanner = (
  items: TAttentionItem[],
  overrides: Partial<ChatAttentionBannerProps> = {},
) => {
  const onGoToRequest = vi.fn<ChatAttentionBannerProps['onGoToRequest']>();
  const user = userEvent.setup();
  const view = renderWithProviders(
    <ChatAttentionBanner
      items={items}
      onGoToRequest={onGoToRequest}
      {...overrides}
    />,
  );
  return { user, onGoToRequest, view };
};

describe('ChatAttentionBanner', () => {
  it('no renderiza nada sin pendientes (FR-011, A4)', () => {
    const { view } = renderBanner([]);

    expect(view.container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('chat-attention-banner')).toBeNull();
  });

  it('anuncia con un Alert que el agente necesita respuesta (FR-009)', () => {
    renderBanner([permission]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('El agente necesita tu respuesta');
  });

  it('resume el pendiente con texto claro, no solo color (FR-009, FR-021)', () => {
    renderBanner([permission]);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Solicitud pendiente (permiso): bash',
    );
  });

  it('resume el tipo pregunta con su título', () => {
    renderBanner([question]);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Solicitud pendiente (pregunta): ¿Confirmas el despliegue?',
    );
  });

  it('con varios pendientes indica el total y apunta al más antiguo', () => {
    renderBanner([question, permission]);

    expect(screen.getByRole('alert')).toHaveTextContent(
      '2 solicitudes pendientes; la más antigua (permiso): bash',
    );
  });

  it('lleva a la request origen del pendiente más antiguo al accionar (FR-010, A7)', async () => {
    const { user, onGoToRequest } = renderBanner([question, permission]);

    await user.click(
      screen.getByRole('button', { name: 'Ir a la solicitud' }),
    );

    expect(onGoToRequest).toHaveBeenCalledTimes(1);
    expect(onGoToRequest).toHaveBeenCalledWith(permission);
  });

  it('ofrece la acción con un nombre textual accesible', () => {
    renderBanner([permission]);

    expect(
      screen.getByRole('button', { name: 'Ir a la solicitud' }),
    ).toBeInTheDocument();
  });
});
