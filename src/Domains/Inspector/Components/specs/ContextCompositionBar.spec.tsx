import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TContextBucket } from '@app/Domains/Graph/Graph.entity';
import { ContextCompositionBar } from '../ContextCompositionBar';

const buckets: TContextBucket[] = [
  { category: 'toolResult', chars: 470, tokens: 470, pct: 47 },
  { category: 'reasoning', chars: 260, tokens: 260, pct: 26 },
  { category: 'toolInput', chars: 220, tokens: 220, pct: 22 },
];

describe('ContextCompositionBar · S2', () => {
  it('muestra la leyenda con etiqueta, porcentaje y valor absoluto', () => {
    render(<ContextCompositionBar buckets={buckets} hasTokens />);

    expect(screen.getByText('Resultados de herramientas')).toBeInTheDocument();
    expect(screen.getByText('47%')).toBeInTheDocument();
    expect(screen.getByText('470 tok')).toBeInTheDocument();
    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
    expect(screen.getByText('26%')).toBeInTheDocument();
  });

  it('describe la composición con un aria-label textual', () => {
    render(<ContextCompositionBar buckets={buckets} hasTokens />);

    expect(
      screen.getByRole('img', { name: /Composición del contexto:/ }),
    ).toBeInTheDocument();
  });

  it('muestra caracteres cuando no hay tokens medibles', () => {
    render(
      <ContextCompositionBar
        buckets={[{ category: 'userText', chars: 70, tokens: null, pct: 100 }]}
        hasTokens={false}
      />,
    );

    expect(screen.getByText('70 car')).toBeInTheDocument();
    expect(screen.getByText('Texto del usuario')).toBeInTheDocument();
  });
});
