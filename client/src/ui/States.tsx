import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState — shared "nothing here yet" surface used by the hub, cart, and
 * each front-door panel before input.
 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-10 px-4 ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary-ink flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-heading font-bold text-dark mb-1">{title}</h3>
      {description && <p className="text-muted text-sm max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * ErrorState — shared error/degraded surface. Used when an endpoint fails or
 * returns a degraded result; offers an optional retry action.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We hit a snag. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}: ErrorStateProps) {
  return (
    <div role="alert" className={`text-center py-10 px-4 ${className}`}>
      <div className="w-16 h-16 rounded-full bg-accent/10 text-accent-dark flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={28} />
      </div>
      <h3 className="font-heading font-bold text-dark mb-1">{title}</h3>
      {description && <p className="text-muted text-sm max-w-md mx-auto">{description}</p>}
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
