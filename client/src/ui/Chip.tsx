import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-light-bg text-muted',
  primary: 'bg-primary-light text-primary-ink',
  secondary: 'bg-secondary/15 text-secondary-dark',
  accent: 'bg-accent/10 text-accent-dark',
  // success/warning/danger tuned to meet >= 4.5:1 text contrast on their tints
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

interface ChipProps {
  tone?: ChipTone;
  size?: 'xs' | 'sm';
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Chip — small status/label pill. Used for confidence scores, substitution
 * flags, tags, and badges. Tones are chosen for AA text contrast.
 */
export default function Chip({ tone = 'neutral', size = 'sm', icon, className = '', children }: ChipProps) {
  const sizing = size === 'xs' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-0.5 gap-1';
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap',
        sizing,
        TONES[tone],
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </span>
  );
}
