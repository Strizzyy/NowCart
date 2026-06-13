import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm',
  secondary: 'bg-secondary text-dark hover:bg-secondary-dark hover:text-white',
  accent: 'bg-accent text-white hover:bg-accent-dark shadow-sm',
  outline: 'border border-border bg-white text-dark hover:border-primary hover:text-primary',
  ghost: 'bg-transparent text-muted hover:text-primary hover:bg-primary-light',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-lg',
  lg: 'text-base px-6 py-3 gap-2 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Button — the shared action primitive. Consistent radius, focus ring
 * (handled globally by :focus-visible), spacing, and a loading state.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-semibold transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 20 : 16} className="text-current" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
