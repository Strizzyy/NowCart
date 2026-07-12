import { X, Trash2, Plus, Minus, AlertTriangle, Sparkles, PackageX, XCircle, BadgeDollarSign, Star, Truck, Clock, ShoppingBag, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppContext } from '../App';
import { postCartOp } from '../api/client';
import { useEffect, useState } from 'react';
import { Button, Chip, EmptyState } from '../ui';
import WhyThisOne from './cart/WhyThisOne';
import HitlPrompt from './cart/HitlPrompt';
import EngineTrail from './cart/EngineTrail';
import ReplanBar from './cart/ReplanBar';
import NowCartVerified from './NowCartVerified';

interface Props {
  ctx: AppContext;
}

export default function CartDrawer({ ctx }: Props) {
  const { cart, cartOpen, setCartOpen, setCart } = ctx;
  const [loading, setLoading] = useState<string | null>(null);
  const [proceeded, setProceeded] = useState(false);
  const [highlightLow, setHighlightLow] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommended' | 'economical'>('recommended');
  const [toastDismissed, setToastDismissed] = useState<string | null>(null); // tracks dismissed toast by key
  const [notesExpanded, setNotesExpanded] = useState(false);
  const navigate = useNavigate();

  // Compute which toast (if any) should show based on current tab + cart
  const budgetSavings = (cart?.remaining_budget ?? 0) > 0 ? cart!.remaining_budget! : null;
  const economicalSavings = (cart && cart.total > cart.economical_total && activeTab === 'economical')
    ? cart.total - cart.economical_total
    : null;

  // Each toast has a unique key so dismissing one doesn't affect the other
  const toastKey = activeTab === 'economical' && economicalSavings
    ? `eco-${cart?.session_id}`
    : budgetSavings && activeTab === 'recommended'
    ? `budget-${cart?.session_id}`
    : null;

  const toastAmount = activeTab === 'economical' ? economicalSavings : budgetSavings;
  const toastLabel = activeTab === 'economical' ? 'vs recommended picks' : 'under budget';
  const showSavingsToast = !!(toastKey && toastAmount && toastDismissed !== toastKey);

  // Lock background scroll when cart is open (iOS-safe)
  useEffect(() => {
    if (!cartOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [cartOpen]);

  // reset whenever a new cart arrives
  useEffect(() => {
    setProceeded(false);
    setHighlightLow(false);
    setActiveTab('recommended');
    setNotesExpanded(false);
    setToastDismissed(null);
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

  const handleClearCart = async () => {
    if (!cart) return;
    setLoading('__clear__');
    try {
      const updated = await postCartOp(cart.session_id, 'clear');
      setCart(updated);
    } catch { /* ignore */ }
    setLoading(null);
  };

  const showHitl = !!cart?.clarification && !proceeded;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-dark/45 z-50 nc-fade-in" onClick={() => setCartOpen(false)} aria-hidden="true" />

      {/* Drawer - bottom sheet on mobile, side panel on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your confident cart"
        className="fixed top-0 right-0 h-full w-full md:max-w-md bg-surface z-50 shadow-[var(--shadow-pop)] flex flex-col md:top-0 md:bottom-auto"
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

        {/* Savings toast — context-aware: budget tab shows budget savings, economical tab shows economical savings */}
        {showSavingsToast && toastAmount != null && (
          <div
            className="relative mx-5 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #166534 100%)' }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10" />
            <div className="absolute right-6 -bottom-4 w-10 h-10 rounded-full bg-white/10" />
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Tag size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-extrabold text-white">₹{toastAmount.toFixed(0)} saved </span>
              <span className="text-xs text-white/70">{toastLabel}</span>
            </div>
            <button
              onClick={() => toastKey && setToastDismissed(toastKey)}
              className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition shrink-0"
              aria-label="Dismiss"
            >
              <X size={11} className="text-white" />
            </button>
          </div>
        )}

        {/* Cart content */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-5 py-4">          {!cart || cart.items.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={28} />}
              title="Your cart is empty"
              description='Open a front door on the home page — speak, budget, show, share, or subscribe — and the engine builds your cart here.'
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

              {/* Conversational Re-planning */}
              {!showHitl && cart.items.length > 0 && !cart.notes.some(n => n.includes('Predicted restock') || n.includes('subscription')) && (
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

              {/* Unmatched / couldn't-add notes — collapsible, collapsed by default.
                  cart.notes is a general-purpose bag (meal-context marker, unmatched-need
                  notices, budget-drop notices, restock/subscription notices) — only the
                  genuine drop notices belong in a "couldn't fit" count. */}
              {(() => {
                const droppableNotes = cart.notes.filter(n =>
                  !n.startsWith('🍽️') && !n.includes('Predicted restock') && !n.includes('subscription')
                );
                return droppableNotes.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setNotesExpanded(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-light-bg hover:bg-border/40 transition text-left"
                    >
                      <p className="text-xs font-semibold text-muted flex items-center gap-1.5">
                        <PackageX size={12} aria-hidden="true" />
                        {droppableNotes.length} item{droppableNotes.length === 1 ? '' : 's'} couldn't fit
                      </p>
                      <span className="text-[10px] text-muted">{notesExpanded ? 'Hide ▲' : 'Show ▼'}</span>
                    </button>
                    {notesExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-0.5">
                        {droppableNotes.map((note, i) => (
                          <p key={i} className="text-xs text-muted">{note}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Section Tabs: Recommended vs Economical */}
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
              {/* {cart.economical_items && cart.economical_items.length > 0 && (
                <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-1">
                  {activeTab === 'recommended' ? '⭐ Best quality picks' : '💰 Budget-friendly picks'}
                </p>
              )} */}

              {/* Items */}
              {[...(activeTab === 'recommended' ? cart.items : (cart.economical_items || []))].reverse().map((item) => {
                const isVerified = activeTab === 'recommended' && item.confidence >= 0.8;
                return (
                  <div
                    key={item.product_id}
                    className={[
                      'flex items-start gap-3 p-3 rounded-xl transition',
                      'bg-light-bg',
                      highlightLow && !isVerified ? 'ring-2 ring-amber-300' : '',
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

                      {/* NowCart Verified badge or savings chip */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {isVerified && <NowCartVerified size="xs" />}
                        {/* Subscription badge */}
                        {(item.reason?.toLowerCase().includes('subscription') || item.reason?.toLowerCase().includes('recurring')) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                            🔔 {item.reason?.toLowerCase().includes('daily') ? 'Daily' : item.reason?.toLowerCase().includes('weekly') ? 'Weekly' : 'Monthly'} subscription
                          </span>
                        )}
                        {activeTab === 'economical' && item.reason && item.reason.includes('saves') && (
                          <Chip tone="success" size="xs" icon={<BadgeDollarSign size={10} />}>
                            {item.reason.match(/saves ₹\d+/)?.[0] || 'Cheaper'}
                          </Chip>
                        )}
                      </div>

                      {/* Recently-ordered prompt */}
                      {item.recently_ordered && (item.days_ago ?? 0) > 0 && (
                        <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-blue-600 shrink-0" aria-hidden="true" />
                            <p className="text-[11px] text-blue-800">
                              You ordered this {item.days_ago ?? 0} day{(item.days_ago ?? 0) === 1 ? '' : 's'} ago — still need it?
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemove(item.name)}
                            disabled={loading === item.name}
                            className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 underline shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* OOS suggestion */}
                      {item.out_of_stock_suggestion && (
                        <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ShoppingBag size={11} className="text-amber-600 shrink-0" aria-hidden="true" />
                            <p className="text-[11px] text-amber-800 truncate">
                              Original OOS — also try: <span className="font-semibold">{item.out_of_stock_suggestion.name}</span> ₹{item.out_of_stock_suggestion.price}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Why this one */}
                      <WhyThisOne item={item} />

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleQuantity(item.name, Math.max(1, item.quantity - 1))}
                          disabled={loading === item.name}
                          className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-surface border border-border flex items-center justify-center hover:border-primary transition disabled:opacity-50"
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span className="text-sm font-medium min-w-[24px] text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantity(item.name, item.quantity + 1)}
                          disabled={loading === item.name}
                          className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-surface border border-border flex items-center justify-center hover:border-primary transition disabled:opacity-50"
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleRemove(item.name)}
                          disabled={loading === item.name}
                          className="ml-auto p-2 text-muted hover:text-accent-dark transition disabled:opacity-50"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Cart-level reasoning trail */}
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
                onClick={() => {
                  setCartOpen(false);
                  navigate('/checkout', { state: { activeTab } });
                }}
                leftIcon={<Truck size={16} />}
              >
                Proceed to Payment →
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
