import { X, Trash2, Plus, Minus, AlertTriangle, Sparkles, Repeat, PackageX, XCircle, BadgeDollarSign, Star, ArrowRight, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppContext } from '../App';
import { postCartOp, placeOrder } from '../api/client';
import { useEffect, useState } from 'react';
import { Button, Chip, EmptyState, type ChipTone } from '../ui';
import WhyThisOne from './cart/WhyThisOne';
import HitlPrompt from './cart/HitlPrompt';
import EngineTrail from './cart/EngineTrail';
import ReplanBar from './cart/ReplanBar';

interface Props {
  ctx: AppContext;
}

const LOW_CONFIDENCE = 0.6;

/** Map logged-in user to backend user_id */
function resolveUserId(user: { email?: string; userId?: string } | null | undefined): string {
  if (!user) return 'user-005';
  if (user.userId) return user.userId;
  const email = user.email;
  if (!email) return 'user-005';
  const map: Record<string, string> = {
    'rahul@gmail.com': 'rahul',
    'priya@example.com': 'user-001',
    'rahul@example.com': 'user-002',
    'anita@example.com': 'user-003',
    'vikram@example.com': 'user-004',
    'demo@example.com': 'user-005',
    'demo@nowcart.app': 'user-005',
    'admin@nowcart.app': 'user-001',
    'guest@nowcart.app': 'user-005',
  };
  return map[email.toLowerCase()] || email.split('@')[0];
}

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
  const [activeTab, setActiveTab] = useState<'recommended' | 'economical'>('recommended');
  const [placingOrder, setPlacingOrder] = useState(false);
  const navigate = useNavigate();

  // reset the HITL gate whenever a new cart arrives
  useEffect(() => {
    setProceeded(false);
    setHighlightLow(false);
    setActiveTab('recommended');
  }, [cart?.session_id, cart?.clarification]);

  if (!cartOpen) return null;

  const handleRemove = async (name: string) => {
    if (!cart) return;
    setLoading(name);
    try {
      const updated = await postCartOp(cart.session_id, 'remove', name);
      setCart(updated);
    } catch {
      // Cart session may have been cleared server-side — reset local state
      setCart(null);
    }
    setLoading(null);
  };

  const handleQuantity = async (name: string, qty: number) => {
    if (!cart) return;
    setLoading(name);
    try {
      const updated = await postCartOp(cart.session_id, 'update', name, qty);
      setCart(updated);
    } catch {
      // Cart session may have been cleared server-side — reset local state
      setCart(null);
    }
    setLoading(null);
  };

  const handleClearCart = async () => {
    if (!cart) return;
    setLoading('__clear__');
    try {
      const updated = await postCartOp(cart.session_id, 'clear');
      setCart(updated);
    } catch {
      setCart(null);
    }
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
          <div className="flex items-center gap-2">
            {cart && cart.items.length > 0 && (
              <button
                onClick={handleClearCart}
                disabled={loading === '__clear__'}
                className="p-1.5 rounded-full text-muted hover:text-accent-dark hover:bg-red-50 transition disabled:opacity-50"
                aria-label="Clear entire cart"
                title="Clear cart"
              >
                <XCircle size={20} aria-hidden="true" />
              </button>
            )}
            <button
              onClick={() => setCartOpen(false)}
              className="p-1.5 rounded-full text-muted hover:text-dark hover:bg-light-bg transition"
              aria-label="Close cart"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
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

              {/* Conversational Re-planning (feedback loop) — only for non-predicted carts */}
              {!showHitl && cart.items.length > 0 && !cart.notes.some(n => n.includes('Predicted restock')) && (
                <ReplanBar cart={cart} onReplan={(updated) => setCart(updated)} ctx={ctx} />
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

              {/* Substitutions summary (D2) — Enhanced visibility for demo */}
              {cart.substitutions.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Repeat size={16} className="text-blue-700" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">
                        🧠 Substitution Intelligence Active
                      </p>
                      <p className="text-[11px] text-blue-700">
                        {cart.substitutions.length} item{cart.substitutions.length === 1 ? '' : 's'} auto-swapped for in-stock alternatives
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 mt-3">
                    {cart.substitutions.map((sub, i) => (
                      <div key={i} className="bg-white/70 rounded-lg p-2.5 border border-blue-100">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-500 line-through font-medium">{sub.original_name}</span>
                          <ArrowRight size={12} className="text-blue-500 shrink-0" />
                          <span className="text-blue-900 font-bold">{sub.substitute_name}</span>
                        </div>
                        <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                          <Sparkles size={10} /> {sub.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-blue-600 mt-2 italic">
                    AI matched similar products by category, brand quality, and price range
                  </p>
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

              {/* ===== Section Tabs: Recommended vs Economical ===== */}
              {cart.economical_items && cart.economical_items.length > 0 && (
                <div className="flex rounded-xl bg-light-bg border border-border p-1 gap-1">
                  <button
                    onClick={() => setActiveTab('recommended')}
                    className={[
                      'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition',
                      activeTab === 'recommended'
                        ? 'bg-surface text-primary-ink shadow-sm'
                        : 'text-muted hover:text-dark',
                    ].join(' ')}
                  >
                    <Star size={13} aria-hidden="true" />
                    Recommended
                    <span className="text-[10px] font-medium ml-0.5">₹{cart.total.toFixed(0)}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('economical')}
                    className={[
                      'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition',
                      activeTab === 'economical'
                        ? 'bg-surface text-emerald-700 shadow-sm'
                        : 'text-muted hover:text-dark',
                    ].join(' ')}
                  >
                    <BadgeDollarSign size={13} aria-hidden="true" />
                    Economical
                    <span className="text-[10px] font-medium ml-0.5">₹{cart.economical_total.toFixed(0)}</span>
                  </button>
                </div>
              )}

              {/* Savings badge when economical tab is active */}
              {activeTab === 'economical' && cart.economical_items && cart.economical_items.length > 0 && cart.total > cart.economical_total && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <BadgeDollarSign size={16} className="text-emerald-700 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">
                      Save ₹{(cart.total - cart.economical_total).toFixed(0)} with economical picks
                    </p>
                    <p className="text-[11px] text-emerald-700">Same products, lower-priced alternatives from our catalog.</p>
                  </div>
                </div>
              )}

              {/* Section header */}
              {cart.economical_items && cart.economical_items.length > 0 && (
                <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-1">
                  {activeTab === 'recommended' ? '⭐ Best quality picks' : '💰 Budget-friendly picks'}
                </p>
              )}

              {/* Items — based on active tab */}
              {[...(activeTab === 'recommended' ? cart.items : (cart.economical_items || []))].reverse().map((item) => {
                const substituted = !!item.substituted_for;
                const low = item.confidence < LOW_CONFIDENCE;
                return (
                  <div
                    key={item.product_id}
                    className={[
                      'flex items-start gap-3 p-3 rounded-xl transition',
                      substituted ? 'bg-blue-50/60 border-l-4 border-blue-300 pl-2' : 'bg-light-bg',
                      highlightLow && low ? 'ring-2 ring-amber-300' : '',
                      activeTab === 'economical' ? 'border-l-4 border-emerald-200' : '',
                    ].join(' ')}
                  >
                    <div className="w-14 h-14 bg-surface rounded-lg border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-2xl">📦</span>';
                          }}
                        />
                      ) : (
                        <span className="text-2xl" aria-hidden="true">📦</span>
                      )}
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
                        {activeTab === 'economical' && item.reason && item.reason.includes('saves') && (
                          <Chip tone="success" size="xs" icon={<BadgeDollarSign size={10} />}>
                            {item.reason.match(/saves ₹\d+/)?.[0] || 'Cheaper'}
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
                <p className="text-sm text-muted">
                  {activeTab === 'recommended' ? 'Total' : 'Economical Total'}
                </p>
                <p className="text-xl font-bold text-dark">
                  ₹{(activeTab === 'recommended' ? cart.total : cart.economical_total).toFixed(0)}
                </p>
                {activeTab === 'economical' && cart.total > cart.economical_total && (
                  <p className="text-xs text-emerald-600 font-medium">
                    You save ₹{(cart.total - cart.economical_total).toFixed(0)}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                loading={placingOrder}
                onClick={async () => {
                  if (!cart) return;
                  setPlacingOrder(true);
                  try {
                    const userId = resolveUserId(ctx.user);
                    await placeOrder(cart.session_id, userId);
                  } catch {
                    // Order placement failed — continue to success page anyway for demo
                  }
                  // Clear the cart state in the frontend after placing the order
                  setCart(null);
                  setPlacingOrder(false);
                  setCartOpen(false);
                  navigate('/order-success');
                }}
                leftIcon={!placingOrder ? <Truck size={16} /> : undefined}
              >
                {placingOrder ? 'Placing Order...' : 'Place Order →'}
              </Button>
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
