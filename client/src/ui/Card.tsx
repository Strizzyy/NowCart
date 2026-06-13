import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** add hover elevation + border highlight (for clickable cards) */
  interactive?: boolean;
  /** padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6 md:p-8',
};

/**
 * Card — the shared surface primitive: white background, rounded corners,
 * soft elevation, and a consistent border.
 */
export default function Card({
  interactive = false,
  padding = 'md',
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={[
        'bg-surface border border-border rounded-2xl',
        'shadow-[var(--shadow-card)]',
        PADDING[padding],
        interactive
          ? 'transition-all duration-200 hover:shadow-[var(--shadow-pop)] hover:border-primary/40 cursor-pointer'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
