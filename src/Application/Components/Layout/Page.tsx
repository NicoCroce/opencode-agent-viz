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
  /** Línea de contexto bajo el título; opcional. */
  description?: string;
  size?: 'small' | 'full';
  headerRight?: React.ReactNode;
  backButton?: boolean;
}

export const Page = ({
  children,
  title,
  description,
  size = 'full',
  headerRight,
  backButton = false,
}: PageProps) => {
  const { isMobile } = useDevice();

  const small =
    size === 'small' ? 'max-w-[640px]' : 'md:max-w-[980px] lg:max-w-[1440px]';

  const classContainer = clsx(
    'w-full flex flex-col gap-4 md:gap-6 mx-auto',
    small,
  );
  const { setQueryData } = useGlobalStore(STORE_KEY.backButtonEnabled);

  useEffect(() => {
    setQueryData(backButton);
  }, [backButton, setQueryData]);

  return (
    <div className="page grid h-full max-w-[100vw] grid-rows-[min-content_auto] grid-cols-1 gap-5 overflow-auto px-4 pb-10 pt-6 md:px-8">
      <Container
        row={isMobile ? false : true}
        justify="between"
        align={isMobile ? 'start' : 'center'}
        className={clsx('mx-auto w-full border-b border-border/50 pb-4', small)}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <Title variant="h1">{title}</Title>
          {description ? (
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
              <span
                aria-hidden
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal"
              />
              {description}
            </p>
          ) : null}
        </div>
        {headerRight && (
          <Container className="self-end">{headerRight}</Container>
        )}
      </Container>

      <section className={classContainer}>{children}</section>
    </div>
  );
};
