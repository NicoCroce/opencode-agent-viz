import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TContextWindow, TNodeMetrics } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { AgentNodeFooter } from '../AgentNodeFooter';

const metrics = (overrides: Partial<TNodeMetrics> = {}): TNodeMetrics => ({
  ...EMPTY_METRICS,
  startedAt: 0,
  endedAt: 60_000,
  durationMs: 60_000,
  ...overrides,
});

const window = (overrides: Partial<TContextWindow> = {}): TContextWindow => ({
  windowTokens: 1200,
  cacheRead: 0,
  cacheWrite: 0,
  hitRate: null,
  costPerKToken: null,
  ...overrides,
});

const renderFooter = (
  overrides: {
    metrics?: TNodeMetrics;
    contextWindow?: TContextWindow | null;
    /**
     * Condición compartida con `cardHeight` (FR-011): el pie no la recalcula,
     * la recibe resuelta desde `AgentNode` (igual que en producción).
     */
    hasContextFlow?: boolean;
  } = {},
) =>
  render(
    <AgentNodeFooter
      metrics={overrides.metrics ?? metrics()}
      contextWindow={overrides.contextWindow ?? null}
      hasContextFlow={overrides.hasContextFlow ?? false}
      isRunning={false}
      status="succeeded"
      currentTool={null}
      retry={null}
      interruptReason={null}
    />,
  );

describe('AgentNodeFooter · flujo in/out (S7, FR-011)', () => {
  it('muestra entrada (ventana) y salida (output + reasoning)', () => {
    renderFooter({
      hasContextFlow: true,
      contextWindow: window({ windowTokens: 1200 }),
      metrics: metrics({
        tokens: {
          input: 1000,
          output: 200,
          reasoning: 50,
          cacheRead: 0,
          cacheWrite: 0,
        },
      }),
    });

    expect(screen.getByText('contexto: 1.2k ↓ · 250 ↑')).toBeInTheDocument();
  });

  it('cae a "no disponible" en el extremo ausente, nunca a cero', () => {
    renderFooter({
      hasContextFlow: true,
      contextWindow: window({ windowTokens: 800 }),
      metrics: metrics({
        tokens: {
          input: 100,
          output: null,
          reasoning: null,
          cacheRead: 0,
          cacheWrite: 0,
        },
      }),
    });

    expect(screen.getByText('contexto: 800 ↓ · — ↑')).toBeInTheDocument();
  });

  it('muestra la fila cuando solo hay salida (ventana ausente)', () => {
    renderFooter({
      hasContextFlow: true,
      contextWindow: null,
      metrics: metrics({
        tokens: {
          input: 100,
          output: 200,
          reasoning: null,
          cacheRead: 0,
          cacheWrite: 0,
        },
      }),
    });

    expect(screen.getByText('contexto: — ↓ · 200 ↑')).toBeInTheDocument();
  });

  it('no muestra la línea cuando no hay ventana ni salida', () => {
    renderFooter({ contextWindow: null });

    expect(screen.queryByText(/contexto:/)).not.toBeInTheDocument();
  });

  it('obedece la condición compartida y no la recalcula localmente', () => {
    // La condición llega resuelta desde `cardHeight.hasContextFlow` (FR-011):
    // con ella en `false` el pie no pinta la fila aunque haya tokens.
    renderFooter({
      hasContextFlow: false,
      contextWindow: window({ windowTokens: 1200 }),
      metrics: metrics({
        tokens: {
          input: 1000,
          output: 200,
          reasoning: 50,
          cacheRead: 0,
          cacheWrite: 0,
        },
      }),
    });

    expect(screen.queryByText(/contexto:/)).not.toBeInTheDocument();
  });
});
