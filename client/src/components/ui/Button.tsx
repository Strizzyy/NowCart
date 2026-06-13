import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-secondary text-dark hover:bg-secondary-dark hover:text-white',
  danger: 'bg-accent text-white hover:bg-accent-dark',
  ghost: 'bg-transparent text-dark hover:bg-light-bg',
  outline: 'bg-white text-dark border border-border hover:border-primary hover:text-primary-ink',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-2 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2',
};

/** Primary interactive control. Always focusable, with a visible focus ring (global). */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-md)] font-semibold',
        'transition-colors duration-[var(--duration-fast)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
