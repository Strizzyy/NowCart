import { ShoppingCart, ArrowRight, Info } from 'lucide-react';
import { Button, Chip, type ChipTone } from '../../ui';
import type { CartResponse } from '../../api/client';

interface Props {
  cart: CartResponse;
  /** open the full cart drawer */
  onViewCart: () => void;
  /** caption above the result, e.g. the interpreted request or source */
  caption?: React.ReactNode;
}

function confidenceTone(c: number): ChipTone {
  if (c >= 0.8) return 'success';
  if (c >= 0.5) return 'warning';
  return 'danger';
}

/**
 * Minimal in-panel cart summary shared by all four front doors (sub-task 8.2).
 * The richer confident-cart presentation (reasoning trail, HITL, per-item
 * substitution detail) is layered on in sub-task 8.3.
 */
export default function PanelResult({ cart, onViewCart, caption }: Props) {
  return (
    <div className="space-y-3">
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
        <Chip tone={confidenceTone(cart.confidence)} size="xs">
          {Math.round(cart.confidence * 100)}% confident
        </Chip>
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
          {cart.remaining_budget != null && (
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
