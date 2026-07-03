import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { PopIn } from './Transition';

interface PanelProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** short descriptive subtitle shown under the title */
  subtitle?: ReactNode;
  /** optional icon node shown beside the title */
  icon?: ReactNode;
  /** optional accent tint for the header icon badge */
  tone?: 'primary' | 'secondary' | 'accent';
  children?: ReactNode;
  footer?: ReactNode;
}

const ICON_TONES: Record<NonNullable<PanelProps['tone']>, string> = {
  primary: 'bg-primary-light text-primary-ink',
  secondary: 'bg-secondary/15 text-secondary-dark',
  accent: 'bg-accent/10 text-accent-dark',
};

/**
 * Panel — accessible modal surface used by the four front doors. Opens
 * client-side (no navigation/reload), traps initial focus, closes on Escape
 * or backdrop click, and locks body scroll while open. Renders as a bottom
 * sheet on mobile and a centered dialog on larger screens.
 */
export default function Panel({
  open,
  onClose,
  title,
  subtitle,
  icon,
  tone = 'primary',
  children,
  footer,
}: PanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // move focus into the panel
    const toFocus = dialogRef.current?.querySelector<HTMLElement>(
      '[data-autofocus], button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    toFocus?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark/45 nc-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <PopIn
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          className="bg-surface w-full rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-pop)] flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-4 md:px-5 py-4 border-b border-border">
            {icon && (
              <span className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${ICON_TONES[tone]}`}>
                {icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-bold text-lg md:text-xl text-dark leading-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 md:p-1.5 rounded-full text-muted hover:text-dark hover:bg-light-bg transition shrink-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 md:px-5 py-5">{children}</div>

          {/* Footer */}
          {footer && <div className="border-t border-border px-4 md:px-5 py-4">{footer}</div>}
        </div>
      </PopIn>
    </div>
  );
}
