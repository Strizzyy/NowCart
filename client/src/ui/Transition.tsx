import type { HTMLAttributes, ReactNode } from 'react';

interface TransitionProps extends HTMLAttributes<HTMLDivElement> {
  /** stagger delay in ms (useful when mapping a list) */
  delay?: number;
  children?: ReactNode;
}

/**
 * FadeIn — slides up + fades content in. Honors prefers-reduced-motion
 * (the global CSS neutralizes the animation duration).
 */
export function FadeIn({ delay, className = '', style, children, ...rest }: TransitionProps) {
  return (
    <div
      {...rest}
      className={`nc-fade-in ${className}`}
      style={{ ...style, animationDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

/**
 * PopIn — scales content in from slightly smaller. Used for panels, toasts,
 * and modal surfaces.
 */
export function PopIn({ delay, className = '', style, children, ...rest }: TransitionProps) {
  return (
    <div
      {...rest}
      className={`nc-pop-in ${className}`}
      style={{ ...style, animationDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
