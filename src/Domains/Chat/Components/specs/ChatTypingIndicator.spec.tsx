import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { ChatTypingIndicator } from '../ChatTypingIndicator';

/**
 * Indicador animado de "en curso" (FR-004): tres puntos decorativos con el token
 * `--status-running`, `aria-hidden` (el anuncio lo da `role="status"` de
 * `ChatTimeline`) y `title` para el hover. El estado base en `index.css` es
 * opacidad plena, así que sin animación —`prefers-reduced-motion`— los puntos
 * quedan visibles y estáticos.
 */
describe('ChatTypingIndicator', () => {
  it('renderiza tres puntos con el token de actividad', () => {
    const { container } = render(<ChatTypingIndicator />);

    expect(container.querySelectorAll('.chat-typing-dot')).toHaveLength(3);
    expect(screen.getByTestId('chat-typing-indicator').className).toContain(
      'text-status-running',
    );
  });

  it('es decorativo: aria-hidden, title "En curso" y sin rol de anuncio', () => {
    render(<ChatTypingIndicator />);

    const indicator = screen.getByTestId('chat-typing-indicator');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).toHaveAttribute('title', 'En curso');
    // El anuncio accesible vive en `ChatTimeline` (`role="status"`), no aquí.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('index.css — indicador de escritura (FR-004)', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

  it('define los keyframes y la clase base con opacidad plena', () => {
    expect(css).toMatch(/@keyframes\s+chat-typing-dot/);

    const base = css.slice(css.indexOf('.chat-typing-dot {'));
    expect(base).toMatch(/opacity:\s*1/);
    expect(base).toMatch(/animation:\s*chat-typing-dot/);
  });

  it('escala los tres puntos con animation-delay', () => {
    expect(css).toMatch(/\.chat-typing-dot:nth-child\(2\)/);
    expect(css).toMatch(/\.chat-typing-dot:nth-child\(3\)/);
  });
});

describe('ChatTypingIndicator — visibilidad sin animación (FR-004)', () => {
  it('da color visible a cada punto (bg-current) y no los oculta', () => {
    const { container } = render(<ChatTypingIndicator />);

    const dots = Array.from(container.querySelectorAll('.chat-typing-dot'));
    expect(dots).toHaveLength(3);
    for (const dot of dots) {
      expect(dot).toHaveClass('bg-current');
      expect(dot).not.toHaveClass('hidden');
    }
  });

  it('mantiene los puntos visibles con prefers-reduced-motion', () => {
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

    // El bloque de reduced-motion neutraliza las animaciones, pero no toca la
    // visibilidad de los puntos: su estado base (opacidad plena) los deja
    // visibles y estáticos, nunca en blanco.
    const reducedMotion = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
      css.indexOf('/* Entrada de los carriles'),
    );
    expect(reducedMotion).not.toMatch(/chat-typing-dot/);

    const base = css.slice(css.indexOf('.chat-typing-dot {'));
    expect(base.slice(0, base.indexOf('}'))).not.toMatch(/display:\s*none/);
  });
});
