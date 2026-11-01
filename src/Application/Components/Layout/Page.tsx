/**
 * This component is used to create page structures. All "Pages" must be contained within this component.
 */

import clsx from 'clsx';
import { Title } from '../Molecules/Title';
import { Container } from './Container';
import { STORE_KEY, useDevice, useGlobalStore } from '@app/Application/Hooks';
import { useEffect } from 'react';

interface PageProps {
  children: React.ReactNode;
  title: string;
  /**
   * Antetítulo en versalitas mono de acento sobre el título (p. ej. un resumen
   * `3 en curso · 12 sesiones`). Opcional.
   */
  eyebrow?: React.ReactNode;
  size?: 'small' | 'full';
  headerRight?: React.ReactNode;
  backButton?: boolean;
}

/** Ancho máximo de la columna centrada por tamaño de página. */
const PAGE_WIDTH = {
  small: 'max-w-[600px]',
  full: 'max-w-[1120px]',
} as const;

export const Page = ({
  children,
  title,
  eyebrow,
  size = 'full',
  headerRight,
  backButton = false,
}: PageProps) => {
  const { isMobile } = useDevice();
  const { setQueryData } = useGlobalStore(STORE_KEY.backButtonEnabled);

  useEffect(() => {
    setQueryData(backButton);
  }, [backButton, setQueryData]);

  return (
    <div className="page h-full max-w-[100vw] overflow-auto">
      {/* Columna centrada del diseño: 1120px, 48/24/64 de padding en escritorio. */}
      <Container
        space="large"
        className={clsx(
          'mx-auto w-full px-4 pb-16 pt-8 md:px-6 md:pt-12',
          PAGE_WIDTH[size],
        )}
      >
        <Container
          row={!isMobile}
          justify="between"
          align={isMobile ? 'start' : 'end'}
        >
          <Container space="small">
            {eyebrow ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                {eyebrow}
              </span>
            ) : null}
            <Title variant="h1">{title}</Title>
          </Container>
          {headerRight && <Container>{headerRight}</Container>}
        </Container>

        <section className="flex w-full flex-col gap-6">{children}</section>
      </Container>
    </div>
  );
};
