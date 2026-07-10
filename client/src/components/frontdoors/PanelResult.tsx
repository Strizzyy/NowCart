import { ShoppingCart, ArrowRight, Info, Tag, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button, Chip } from '../../ui';
import type { CartResponse } from '../../api/client';

interface Props {
  cart: CartResponse;
  /** open the full cart drawer */
  onViewCart: () => void;
  /** caption above the result, e.g. the interpreted request or source */
  caption?: React.ReactNode;
}

/**
 * Minimal in-panel cart summary shared by all four front doors.
 * Shows a savings toast (Blinkit-style) when remaining_budget > 0.
 */
export default function PanelResult({ cart, onViewCart, caption }: Props) {
  const [showSavings, setShowSavings] = useState(false);

  // Show savings toast briefly when budget was saved
  useEffect(() => {
    if (cart.remaining_budget != null && cart.remaining_budget > 0) {
      setShowSavings(true);
      const t = setTimeout(() => setShowSavings(false), 4000);
      return () => clearTimeout(t);
    }
  }, [cart.session_id]);

  return (
    <div className="space-y-3">
      {/* Savings toast — Blinkit/Swiggy style */}
      {showSavings && cart.remaining_budget != null && cart.remaining_budget > 0 && (
        <div
          className="relative flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-lg overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #166534 100%)' }}
        >
          {/* Decorative circle */}
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 bg-white" />
          <div className="absolute -right-1 -bottom-5 w-14 h-14 rounded-full opacity-10 bg-white" />

          {/* Icon pill */}
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Tag size={18} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base font-extrabold text-white leading-tight">
              ₹{cart.remaining_budget.toFixed(0)} saved!
            </p>
            <p className="text-xs text-white/75 mt-0.5">Cart built within your budget</p>
          </div>

          <button
            onClick={() => setShowSavings(false)}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition shrink-0"
            aria-label="Dismiss"
          >
            <X size={13} className="text-white" />
          </button>
        </div>
      )}

      {caption && (
        <div className="flex items-start gap-2 text-sm text-muted bg-light-bg rounded-lg px-3 py-2">
          <Info size={14} className="mt-0.5 shrink-0 text-primary-ink" aria-hidden="true" />
          <span>{caption}</span>
        </div>
      )}

      {cart.clarification && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          {cart.clarification}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-dark">
          {cart.items.length} item{cart.items.length === 1 ? '' : 's'} in your cart
        </p>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {cart.items.slice(0, 6).map((item) => (
          <li key={item.product_id} className="flex items-center justify-between gap-3 px-3 py-2 bg-surface">
            <div className="min-w-0">
              <p className="text-sm font-medium text-dark truncate">
                {item.name}
                {item.substituted_for && (
                  <Chip tone="info" size="xs" className="ml-2 align-middle">sub</Chip>
                )}
              </p>
              <p className="text-xs text-muted truncate">
                {item.quantity} {item.unit} · {item.brand || 'NowCart'}
              </p>
            </div>
            <span className="text-sm font-semibold text-primary-ink shrink-0">
              ₹{item.line_total.toFixed(0)}
            </span>
          </li>
        ))}
        {cart.items.length > 6 && (
          <li className="px-3 py-2 bg-light-bg text-xs text-muted text-center">
            +{cart.items.length - 6} more
          </li>
        )}
      </ul>

      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg font-bold text-dark">₹{cart.total.toFixed(0)}</p>
          {cart.remaining_budget != null && cart.remaining_budget > 0 && (
            <p className="text-xs text-primary-ink">₹{cart.remaining_budget.toFixed(0)} under budget</p>
          )}
          {cart.shortfall != null && cart.shortfall > 0 && (
            <p className="text-xs text-accent-dark">₹{cart.shortfall.toFixed(0)} over budget</p>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={onViewCart}
          leftIcon={<ShoppingCart size={16} />}
          rightIcon={<ArrowRight size={15} aria-hidden="true" />}
        >
          View full cart
        </Button>
      </div>
    </div>
  );
}
