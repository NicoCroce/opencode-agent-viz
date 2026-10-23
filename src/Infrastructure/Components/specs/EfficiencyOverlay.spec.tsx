import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  buildAssistant,
  buildIdle,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  EfficiencyOverlay,
  type TEfficiencyOverlayProps,
} from '../EfficiencyOverlay';

const BASE_TIME = 1_700_000_000_000;

/** Pedidos distintos para que INP-1 no vea pares similares. */
const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
];

/** Un turno cerrado de la raíz: `user` + `assistant` + `idle`. */
const turnMessages = (index: number) => {
  const start = BASE_TIME + index * 10_000;
  return [
    buildUser({
      id: `user-${index}`,
      time: { created: start },
      text: PROMPTS[index - 1],
    }),
    buildAssistant({
      id: `assistant-${index}`,
      time: { created: start + 1_000, completed: start + 2_000 },
      cost: 0.01,
    }),
    buildIdle('succeeded', {
      id: `idle-${index}`,
      time: { created: start + 5_000 },
    }),
  ];
};

/** Cuatro turnos cerrados: muestra suficiente para puntuar. */
const cleanMessages = () => [1, 2, 3, 4].flatMap(turnMessages);

const seedRoot = (queryClient: QueryClient): void => {
  queryClient.setQueryData(
    queryKeys.sessions.messages('root'),
    cleanMessages(),
  );
};

/** Monta el overlay con la raíz ya cacheada (informe disponible). */
const renderWithReport = (overrides: HarnessProps = {}) =>
  renderWithProviders(<Harness {...overrides} />, {
    queryClient: createTestQueryClient({ gcTime: Infinity }),
    seed: seedRoot,
  });

const baseProps: Omit<
  TEfficiencyOverlayProps,
  'isOpen' | 'onClose' | 'onRestoreFocus'
> = {
  rootSessionId: 'root',
  rootTitle: 'Sesión raíz',
  sessions: {},
  rootReady: false,
  truncated: false,
  graphError: false,
  now: 1_700_000_000_000,
  reference: null,
};

interface HarnessProps
  extends Omit<Partial<TEfficiencyOverlayProps>, 'isOpen'> {
  initialOpen?: boolean;
}

const Harness = ({
  initialOpen = true,
  onClose,
  onRestoreFocus,
  ...overrides
}: HarnessProps) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return (
    <EfficiencyOverlay
      {...baseProps}
      {...overrides}
      isOpen={isOpen}
      onClose={() => {
        onClose?.();
        setIsOpen(false);
      }}
      onRestoreFocus={() => {
        onRestoreFocus?.();
      }}
    />
  );
};

const closeButton = () =>
  screen.getByRole('button', { name: 'Cerrar análisis de eficiencia' });

const dialog = () =>
  screen.getByRole('dialog', { name: 'Eficiencia de la sesión' });

describe('EfficiencyOverlay', () => {
  it('monta un diálogo con nombre accesible y foco inicial dentro', async () => {
    renderWithProviders(<Harness />);

    expect(await screen.findByRole('dialog', { name: 'Eficiencia de la sesión' }))
      .toBeInTheDocument();
    await waitFor(() => expect(closeButton()).toHaveFocus());
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it('atrapa el foco: Tab y Shift+Tab ciclan dentro del diálogo', async () => {
    const user = setupRadixUser();
    renderWithProviders(<Harness />);
    const close = closeButton();
    await waitFor(() => expect(close).toHaveFocus());

    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it('Escape cierra y devuelve el foco al disparador', async () => {
    const user = setupRadixUser();
    const onClose = vi.fn();
    const onRestoreFocus = vi.fn();
    renderWithProviders(
      <Harness onClose={onClose} onRestoreFocus={onRestoreFocus} />,
    );
    await waitFor(() => expect(closeButton()).toHaveFocus());

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onRestoreFocus).toHaveBeenCalledTimes(1));
  });

  it('bloquea el scroll del documento mientras está abierto y lo restaura al cerrar', async () => {
    const user = setupRadixUser();
    const initialOverflow = getComputedStyle(document.body).overflow;
    const initialPointerEvents = document.body.style.pointerEvents;
    renderWithProviders(<Harness />);

    await waitFor(() => expect(closeButton()).toHaveFocus());
    // Radix (react-remove-scroll) bloquea el body con una regla por atributo.
    expect(getComputedStyle(document.body).overflow).toBe('hidden');
    expect(document.body).toHaveAttribute('data-scroll-locked', '1');
    expect(document.body.style.pointerEvents).toBe('none');

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(getComputedStyle(document.body).overflow).toBe(initialOverflow),
    );
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
    expect(document.body.style.pointerEvents).toBe(initialPointerEvents);
  });

  it('“Cerrar” cierra el diálogo y restaura el foco', async () => {
    const user = setupRadixUser();
    const onClose = vi.fn();
    const onRestoreFocus = vi.fn();
    renderWithProviders(
      <Harness onClose={onClose} onRestoreFocus={onRestoreFocus} />,
    );

    await user.click(closeButton());

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onRestoreFocus).toHaveBeenCalledTimes(1));
  });

  it('mantiene header y “Cerrar” en carga', async () => {
    renderWithProviders(<Harness rootReady={false} sessions={{}} />);

    expect(await screen.findByText('Eficiencia de la sesión')).toBeVisible();
    expect(screen.getByText('Análisis de solo lectura de la sesión y su subárbol.'))
      .toBeInTheDocument();
    expect(closeButton()).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando análisis…');
  });

  it('mantiene header y “Cerrar” en error sin informe', async () => {
    renderWithProviders(
      <Harness rootReady={false} graphError sessions={{}} />,
    );

    expect(await screen.findByText('Eficiencia de la sesión')).toBeVisible();
    expect(closeButton()).toBeVisible();
    expect(screen.getByText('No se pudo cargar la sesión.')).toBeInTheDocument();
  });

  it('mantiene header y “Cerrar” en vacío y muestra “Sin mensajes”', async () => {
    renderWithProviders(
      <Harness
        rootReady
        sessions={{ root: {} }}
        rootSessionId="root"
      />,
    );

    expect(await screen.findByText('Eficiencia de la sesión')).toBeVisible();
    expect(closeButton()).toBeVisible();
    expect(await screen.findByText('Sin mensajes')).toBeInTheDocument();
    expect(
      screen.getByText('Esta sesión todavía no reportó mensajes.'),
    ).toBeInTheDocument();
  });

  it('no monta el diálogo cuando está cerrado', () => {
    renderWithProviders(<Harness initialOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('error sin datos nunca se confunde con el vacío', async () => {
    renderWithProviders(<Harness rootReady={false} graphError sessions={{}} />);

    expect(
      await screen.findByText('No se pudo cargar la sesión.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Esta sesión todavía no reportó mensajes.'),
    ).not.toBeInTheDocument();
    expect(closeButton()).toBeVisible();
  });

  it('con datos pinta el informe y conserva el header y “Cerrar”', async () => {
    renderWithReport({
      rootReady: true,
      sessions: { root: {} },
      now: BASE_TIME + 100_000,
    });

    expect(
      await screen.findByRole('img', { name: /de 100/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(screen.getByText('Eficiencia de la sesión')).toBeVisible();
    expect(closeButton()).toBeVisible();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No se pudo cargar la sesión.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Análisis parcial/)).not.toBeInTheDocument();
  });

  it('declara el subárbol parcial con un banner y mantiene el informe', async () => {
    renderWithReport({
      rootReady: true,
      sessions: { root: {}, child: {} },
      now: BASE_TIME + 100_000,
    });

    expect(
      await screen.findByText('Análisis parcial: 1 sesiones sin datos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Análisis parcial: 1 sesiones sin datos',
    );
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(closeButton()).toBeVisible();
  });

  it('declara el grafo truncado sin inventar el conteo de sesiones', async () => {
    renderWithReport({
      rootReady: true,
      sessions: { root: {} },
      truncated: true,
      now: BASE_TIME + 100_000,
    });

    expect(
      await screen.findByText(
        'El grafo está truncado: faltan agentes del subárbol.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(screen.queryByText(/Análisis parcial/)).not.toBeInTheDocument();
  });

  it('conserva el último informe y avisa cuando falla la actualización', async () => {
    renderWithReport({
      rootReady: true,
      sessions: { root: {} },
      graphError: true,
      now: BASE_TIME + 100_000,
    });

    expect(
      await screen.findByText(
        'No se pudieron actualizar los datos; se muestra el último análisis.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(closeButton()).toBeVisible();
    expect(
      screen.queryByText('No se pudo cargar la sesión.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
  });
});
