import { X, Trash2, Plus, Minus, AlertTriangle, Sparkles, Repeat, PackageX } from 'lucide-react';
import type { AppContext } from '../App';
import { postCartOp } from '../api/client';
import { useEffect, useState } from 'react';
import { Button, Chip, EmptyState, type ChipTone } from '../ui';
import WhyThisOne from './cart/WhyThisOne';
import HitlPrompt from './cart/HitlPrompt';
import EngineTrail from './cart/EngineTrail';

interface Props {
  ctx: AppContext;
}

const LOW_CONFIDENCE = 0.6;

function confidenceTone(c: number): ChipTone {
  if (c >= 0.8) return 'success';
  if (c >= 0.5) return 'warning';
  return 'danger';
}

export default function CartDrawer({ ctx }: Props) {
  const { cart, cartOpen, setCartOpen, setCart } = ctx;
  const [loading, setLoading] = useState<string | null>(null);
  const [proceeded, setProceeded] = useState(false);
  const [highlightLow, setHighlightLow] = useState(false);

  // reset the HITL gate whenever a new cart arrives
  useEffect(() => {
    setProceeded(false);
    setHighlightLow(false);
  }, [cart?.session_id, cart?.clarification]);

  if (!cartOpen) return null;

  const handleRemove = async (name: string) => {
    if (!cart) return;
    setLoading(name);
    try {
      const updated = await postCartOp(cart.session_id, 'remove', name);
      setCart(updated);
    } catch { /* ignore */ }
    setLoading(null);
  };

  const handleQuantity = async (name: string, qty: number) => {
    if (!cart) return;
    setLoading(name);
    try {
      const updated = await postCartOp(cart.session_id, 'update', name, qty);
      setCart(updated);
    } catch { /* ignore */ }
    setLoading(null);
  };

  const showHitl = !!cart?.clarification && !proceeded;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-dark/45 z-50 nc-fade-in" onClick={() => setCartOpen(false)} aria-hidden="true" />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your confident cart"
        className="fixed top-0 right-0 h-full w-full max-w-md bg-surface z-50 shadow-[var(--shadow-pop)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-heading font-bold text-lg text-dark">
              Your confident cart {cart && cart.items.length > 0 && `(${cart.items.length})`}
            </h2>
            <p className="text-xs text-muted">One pick per need — we already compared the rest.</p>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="p-1.5 rounded-full text-muted hover:text-dark hover:bg-light-bg transition"
            aria-label="Close cart"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Cart content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.items.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={28} />}
              title="Your cart is empty"
              description='Open a front door on the home page — speak it, constrain it, show it, or share it — and the engine builds your cart here.'
            />
          ) : (
            <div className="space-y-3">
              {/* HITL clarifying gate (C3) */}
              {showHitl && (
                <HitlPrompt
                  question={cart.clarification!}
                  onProceed={() => setProceeded(true)}
                  onShowAlternatives={() => {
                    setHighlightLow(true);
                    setProceeded(true);
                  }}
                />
              )}

              {/* Degraded mode warning */}
              {cart.degraded && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-amber-800">
                    The engine is running in fallback mode. Results may be less accurate.
                  </p>
                </div>
              )}

              {/* Substitutions summary (D2) */}
              {cart.substitutions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                    <Repeat size={12} aria-hidden="true" /> We swapped {cart.substitutions.length} out-of-stock item
                    {cart.substitutions.length === 1 ? '' : 's'}
                  </p>
                  {cart.substitutions.map((sub, i) => (
                    <p key={i} className="text-xs text-blue-700">
                      {sub.original_name} → <strong>{sub.substitute_name}</strong> ({sub.reason})
                    </p>
                  ))}
                </div>
              )}

              {/* Unmatched / couldn't-add notes (flagged) */}
              {cart.notes.length > 0 && (
                <div className="bg-light-bg border border-border rounded-xl p-3">
                  <p className="text-xs font-semibold text-dark mb-1 flex items-center gap-1">
                    <PackageX size={12} aria-hidden="true" /> Heads up
                  </p>
                  {cart.notes.map((note, i) => (
                    <p key={i} className="text-xs text-muted">{note}</p>
                  ))}
                </div>
              )}

              {/* Items */}
              {cart.items.map((item) => {
                const substituted = !!item.substituted_for;
                const low = item.confidence < LOW_CONFIDENCE;
                return (
                  <div
                    key={item.product_id}
                    className={[
                      'flex items-start gap-3 p-3 rounded-xl transition',
                      substituted ? 'bg-blue-50/60 border-l-4 border-blue-300 pl-2' : 'bg-light-bg',
                      highlightLow && low ? 'ring-2 ring-amber-300' : '',
                    ].join(' ')}
                  >
                    <div className="w-14 h-14 bg-surface rounded-lg border border-border flex items-center justify-center shrink-0">
                      <span className="text-2xl" aria-hidden="true">🛒</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dark truncate">{item.name}</p>
                          <p className="text-xs text-muted">{item.brand || 'NowCart'} · {item.unit}</p>
                        </div>
                        <p className="text-sm font-bold text-primary-ink shrink-0">₹{item.line_total.toFixed(0)}</p>
                      </div>

                      {/* Confidence + substitution chips */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Chip tone={confidenceTone(item.confidence)} size="xs">
                          {Math.round(item.confidence * 100)}% confident
                        </Chip>
                        {substituted && (
                          <Chip tone="info" size="xs" icon={<Repeat size={10} />}>
                            Swapped in
                          </Chip>
                        )}
                      </div>

                      {/* Comparison-collapse: one-line why + expandable trail */}
                      <WhyThisOne item={item} />

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleQuantity(item.name, Math.max(1, item.quantity - 1))}
                          disabled={loading === item.name}
                          className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:border-primary transition disabled:opacity-50"
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          <Minus size={12} aria-hidden="true" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantity(item.name, item.quantity + 1)}
                          disabled={loading === item.name}
                          className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:border-primary transition disabled:opacity-50"
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          <Plus size={12} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleRemove(item.name)}
                          disabled={loading === item.name}
                          className="ml-auto p-1 text-muted hover:text-accent-dark transition disabled:opacity-50"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Cart-level reasoning trail (comparison collapse) */}
              <EngineTrail trail={cart.reasoning_trail} />
            </div>
          )}
        </div>

        {/* Footer */}
        {cart && cart.items.length > 0 && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            {cart.budget != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Budget</span>
                <span className="font-medium text-dark">₹{cart.budget.toFixed(0)}</span>
              </div>
            )}
            {cart.remaining_budget != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Remaining</span>
                <span className="font-medium text-primary-ink">₹{cart.remaining_budget.toFixed(0)}</span>
              </div>
            )}
            {cart.shortfall != null && cart.shortfall > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Over budget</span>
                <span className="font-medium text-accent-dark">₹{cart.shortfall.toFixed(0)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted">Total</p>
                <p className="text-xl font-bold text-dark">₹{cart.total.toFixed(0)}</p>
              </div>
              <Button variant="primary" size="md">Checkout →</Button>
            </div>

            <div className="text-center">
              <Chip tone={confidenceTone(cart.confidence)}>
                Overall confidence: {Math.round(cart.confidence * 100)}%
              </Chip>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
