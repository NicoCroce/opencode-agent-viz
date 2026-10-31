import React from 'react';

type TVariant = 'h1' | 'h2' | 'h3' | 'h4';

interface TitleProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLHeadingElement>,
  HTMLHeadingElement
> {
  children: React.ReactNode;
  variant?: TVariant;
  className?: string;
}

const headingClasses = {
  h1: 'scroll-m-20 font-display text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.035em] py-2 pt-6 lg:text-[2.35rem]',
  h2: 'scroll-m-20 font-display border-b border-border/70 pb-2 text-2xl font-semibold tracking-[-0.03em] first:mt-0',
  h3: 'scroll-m-20 font-display text-xl font-semibold tracking-[-0.02em]',
  h4: 'scroll-m-20 font-display text-lg font-semibold tracking-[-0.02em]',
};

export const Title = ({
  children,
  variant = 'h1',
  className = '',
  ...props
}: TitleProps) => {
  const headingClass = `${headingClasses[variant]} ${className}`;

  return React.createElement(
    variant,
    { className: headingClass, ...props },
    children,
  );
};
