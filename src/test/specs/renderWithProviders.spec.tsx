import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { createTestQueryClient, renderWithProviders } from '../renderWithProviders';

const KEY = ['seeded'];

const Probe = () => {
  const { data } = useQuery({ queryKey: KEY, queryFn: () => 'fetched' });
  return <span>{data ?? 'empty'}</span>;
};

describe('renderWithProviders', () => {
  it('siembra la caché antes de renderizar', () => {
    renderWithProviders(<Probe />, {
      queryClient: createTestQueryClient({ gcTime: Infinity }),
      seed: (qc) => qc.setQueryData(KEY, 'seeded'),
    });
    expect(screen.getByText('seeded')).toBeInTheDocument();
  });

  it('usa gcTime 0 por defecto y permite sobrescribirlo', () => {
    expect(createTestQueryClient().getDefaultOptions().queries?.gcTime).toBe(0);
    expect(
      createTestQueryClient({ gcTime: Infinity }).getDefaultOptions().queries?.gcTime,
    ).toBe(Infinity);
  });
});

describe('installRadixPolyfills', () => {
  it('deja disponibles las APIs de puntero que jsdom no trae', () => {
    expect(typeof Element.prototype.hasPointerCapture).toBe('function');
    expect(typeof Element.prototype.scrollIntoView).toBe('function');
  });
});
