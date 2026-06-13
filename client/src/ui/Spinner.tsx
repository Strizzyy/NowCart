import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  /** pixel size of the spinner icon */
  size?: number;
  /** extra classes (e.g. text-primary) */
  className?: string;
  /** accessible label announced to screen readers */
  label?: string;
}

/**
 * Spinner — the single loading indicator primitive used app-wide.
 * Respects prefers-reduced-motion via the global CSS rule.
 */
export default function Spinner({ size = 20, className = 'text-primary', label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
