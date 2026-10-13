import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type {
  TCompactionEffect,
  TNodeContextMetrics,
  TTokenUsage,
} from '@app/Domains/Graph/Graph.entity';
import { ContextSection } from '../ContextSection';

const context = (
  overrides: Partial<TNodeContextMetrics> = {},
): TNodeContextMetrics => ({
  breakdown: {
    buckets: [
      { category: 'toolResult', chars: 470, tokens: 470, pct: 47 },
      { category: 'reasoning', chars: 260, tokens: 260, pct: 26 },
    ],
    chars: 730,
    windowTokens: 1000,
    hasTokens: true,
  },
  window: {
    windowTokens: 1000,
    cacheRead: 700,
    cacheWrite: 0,
    hitRate: 0.7,
    costPerKToken: 0.02,
  },
  latency: null,
  provisional: false,
  ...overrides,
});

const withinSection = () => {
  const heading = screen.getByText('Contexto');
  return within(heading.parentElement as HTMLElement);
};

describe('ContextSection · S1/S3', () => {
  it('muestra la composición y la ventana con datos', () => {
    render(<ContextSection context={context()} />);

    const section = withinSection();
    expect(section.getByText('Resultados de herramientas')).toBeInTheDocument();
    expect(section.getByText('47%')).toBeInTheDocument();
    expect(section.getByText('Ventana de contexto')).toBeInTheDocument();
    expect(section.getByText('Caché (lectura)')).toBeInTheDocument();
    expect(section.getByText('Acierto de caché')).toBeInTheDocument();
    expect(section.getByText('70%')).toBeInTheDocument();
  });

  it('etiqueta el contexto provisional', () => {
    render(<ContextSection context={context({ provisional: true })} />);

    expect(withinSection().getByText('provisional')).toBeInTheDocument();
  });

  it('muestra el estado vacío sin datos', () => {
    render(<ContextSection context={null} />);

    expect(screen.getByText('Sin datos de contexto')).toBeInTheDocument();
    expect(screen.queryByText('Ventana de contexto')).not.toBeInTheDocument();
  });

  it('muestra el estado de carga', () => {
    render(<ContextSection context={null} isLoading />);

    expect(screen.getByTestId('context-section-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Sin datos de contexto')).not.toBeInTheDocument();
  });

  it('muestra el estado de error', () => {
    render(<ContextSection context={null} isError />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Sin datos de contexto')).not.toBeInTheDocument();
  });

  it('renderiza el contenido extra de otras historias', () => {
    render(
      <ContextSection context={context()}>
        <span>sección adicional</span>
      </ContextSection>,
    );

    expect(withinSection().getByText('sección adicional')).toBeInTheDocument();
  });
});

describe('ContextSection · FR-016 (ventana, salida, evolución y compactaciones)', () => {
  const tokens: TTokenUsage = {
    input: 100,
    output: 800,
    reasoning: 200,
    cacheRead: 0,
    cacheWrite: 0,
  };

  it('muestra el coste por 1k tokens de la ventana', () => {
    render(<ContextSection context={context()} />);

    expect(withinSection().getByText('Coste por 1k tokens')).toBeInTheDocument();
    expect(withinSection().getByText('$0.0200')).toBeInTheDocument();
  });

  it('muestra la salida, el razonamiento y su relación', () => {
    render(<ContextSection context={context()} tokens={tokens} />);

    const section = withinSection();
    expect(section.getByText('Salida (respuesta)')).toBeInTheDocument();
    expect(section.getByText('800')).toBeInTheDocument();
    expect(section.getAllByText('Razonamiento').length).toBeGreaterThan(0);
    expect(section.getByText('200')).toBeInTheDocument();
    expect(section.getByText('Razonamiento sobre la salida')).toBeInTheDocument();
    expect(section.getByText('20%')).toBeInTheDocument();
  });

  it('no inventa la relación sin salida ni razonamiento (SC-007)', () => {
    render(
      <ContextSection
        context={context()}
        tokens={{ ...tokens, output: 0, reasoning: 0 }}
      />,
    );

    expect(withinSection().getByText('Razonamiento sobre la salida')).toBeInTheDocument();
    expect(withinSection().getAllByText('—').length).toBeGreaterThan(0);
  });

  it('dibuja la evolución del contexto con etiqueta accesible', () => {
    render(
      <ContextSection
        context={context({
          growth: [
            { stepId: 'a1', startedAt: 10, windowTokens: 1000 },
            { stepId: 'a2', startedAt: 20, windowTokens: 2500 },
          ],
        })}
      />,
    );

    expect(
      withinSection().getByRole('img', {
        name: 'Evolución del contexto: 2 pasos, de 1.0k a 2.5k tokens',
      }),
    ).toBeInTheDocument();
  });

  it('omite la evolución sin pasos medibles', () => {
    render(<ContextSection context={context()} />);

    expect(withinSection().queryByTestId('context-growth')).not.toBeInTheDocument();
  });

  it('lista las compactaciones con motivo, efecto y estado reales', () => {
    const effect: TCompactionEffect = { before: 2500, after: 1000 };
    render(
      <ContextSection
        context={context({
          compactions: [
            { id: 'c1', at: 30, status: 'completed', reason: 'auto' },
          ],
        })}
        compactionEffect={effect}
      />,
    );

    const section = withinSection();
    expect(section.getByText('Compactaciones')).toBeInTheDocument();
    expect(section.getByText('Motivo')).toBeInTheDocument();
    expect(section.getByText('Automática')).toBeInTheDocument();
    expect(section.getByText('Efecto')).toBeInTheDocument();
    expect(section.getByText('2.5k → 1.0k')).toBeInTheDocument();
    expect(section.getByText(/completed/)).toBeInTheDocument();
  });

  it('etiqueta la compactación manual', () => {
    render(
      <ContextSection
        context={context({
          compactions: [{ id: 'c1', at: 30, status: 'completed', reason: 'manual' }],
        })}
      />,
    );

    expect(withinSection().getByText('Manual')).toBeInTheDocument();
  });

  it('muestra el estado vacío por apartado sin compactaciones', () => {
    render(<ContextSection context={context()} />);

    expect(withinSection().getByText('Sin compactaciones')).toBeInTheDocument();
    expect(withinSection().queryByText('Compactaciones')).not.toBeInTheDocument();
  });

  it('deja el efecto sin valor cuando la compactación no tiene extremos', () => {
    render(
      <ContextSection
        context={context({
          compactions: [{ id: 'c1', at: 30, status: 'failed', reason: 'auto' }],
        })}
        compactionEffect={{ before: null, after: null }}
      />,
    );

    expect(withinSection().getByText('Efecto')).toBeInTheDocument();
    expect(withinSection().getAllByText('—').length).toBeGreaterThan(0);
  });
});
