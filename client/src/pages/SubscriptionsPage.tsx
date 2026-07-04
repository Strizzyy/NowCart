import { useState, useEffect } from 'react';
import { Bell, ArrowLeft, Trash2, CheckCircle, Plus, Calendar, Search, X, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppContext } from '../App';
import {
  getUserSubscriptions,
  removeSubscription,
  getDueSubscriptions,
  addSubscription,
  getAllSubscriptionsCart,
  searchCatalog,
  type Subscription,
  type Product,
} from '../api/client';
import { Button, Chip, FadeIn } from '../ui';

interface Props {
  ctx: AppContext;
}

/**
 * Resolve the backend user_id from the logged-in user.
 * Must match exactly what PredictPanel uses so subscriptions are found.
 * Priority: userId set at login (from backend) → email prefix.
 */
function resolveUserId(ctx: AppContext): string {
  if (ctx.user?.userId) return ctx.user.userId;
  const email = (ctx.user?.email ?? '').toLowerCase();
  if (!email) return 'user-001';
  // Hardcoded map mirrors PredictPanel so both use the same key
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
  return map[email] ?? email.split('@')[0];
}

function freqColor(freq: string): 'success' | 'primary' | 'info' {
  if (freq === 'daily') return 'success';
  if (freq === 'weekly') return 'primary';
  return 'info';
}

// ── Inline brand picker ────────────────────────────────────────────────────
interface PickerProps {
  onSelect: (product: Product, freq: 'daily' | 'weekly' | 'monthly') => void;
  onCancel: () => void;
}

function BrandPicker({ onSelect, onCancel }: PickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [freq, setFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchCatalog(query, undefined, 8)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-dark/60" onClick={onCancel} />
      <div className="relative w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        style={{ maxHeight: '92dvh' }}>
        {/* Header — shrink-0 so it never compresses */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <p className="text-sm font-bold text-dark">Add a subscription</p>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-light-bg">
            <X size={16} className="text-muted" />
          </button>
        </div>

        {/* Search — shrink-0 */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-light-bg focus-within:border-primary transition">
            <Search size={14} className="text-muted shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products…"
              className="flex-1 text-sm bg-transparent outline-none text-dark"
            />
            {searching && <span className="text-[11px] text-muted">…</span>}
          </div>
        </div>

        {/* Results — flex-1 + min-h-0 is the critical fix:
            without min-h-0, flex children won't shrink below content height,
            so the list pushes the confirm section off screen */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {!query.trim() && (
            <p className="px-4 py-5 text-sm text-muted text-center">Type to search — e.g. "milk", "eggs"</p>
          )}
          {query.trim() && results.length === 0 && !searching && (
            <p className="px-4 py-5 text-sm text-muted text-center">No products found for "{query}"</p>
          )}
          {results.map(p => (
            <button
              key={p.product_id}
              onClick={() => setSelected(prev => prev?.product_id === p.product_id ? null : p)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-light-bg transition text-left ${
                selected?.product_id === p.product_id ? 'bg-primary-light' : ''
              }`}
            >
              <div className="w-10 h-10 bg-light-bg rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-1"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <span className="text-xl">📦</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-dark truncate">{p.name}</p>
                <p className="text-xs text-muted">{p.brand} · ₹{p.sale_price}</p>
              </div>
              {selected?.product_id === p.product_id && <CheckCircle size={16} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>

        {/* Confirm — shrink-0 + bg-surface so it always stays pinned at the bottom */}
        {selected && (
          <div className="px-4 py-3 border-t border-border space-y-3 bg-surface shrink-0">
            <p className="text-xs font-semibold text-dark">How often?</p>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                    freq === f ? 'bg-primary text-white' : 'bg-light-bg text-muted border border-border hover:text-dark'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={() => onSelect(selected, freq)}
              className="w-full bg-primary text-white text-sm font-semibold py-3 rounded-xl hover:bg-primary-dark active:scale-95 transition"
            >
              Subscribe to {selected.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SubscriptionsPage({ ctx }: Props) {
  const navigate = useNavigate();
  const userId = resolveUserId(ctx);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMsg, setCartMsg] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [dueCart, setDueCart] = useState<any>(null);

  useEffect(() => { loadAll(); }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [subData, dueData] = await Promise.all([
        getUserSubscriptions(userId),
        getDueSubscriptions(userId),
      ]);
      setSubscriptions(subData.subscriptions || []);
      setDueCount(dueData.due_count ?? 0);
      setDueCart(dueData.cart ?? null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleRemove = async (productId: string) => {
    setRemoving(productId);
    try {
      await removeSubscription(userId, productId);
      setSubscriptions(prev => prev.filter(s => s.product_id !== productId));
    } catch { /* ignore */ }
    finally { setRemoving(null); }
  };

  const handleAdd = async (product: Product, freq: 'daily' | 'weekly' | 'monthly') => {
    setShowPicker(false);
    setAdding(true);
    try {
      await addSubscription(userId, product.product_id, product.name, freq);
      await loadAll(); // refresh list from backend
    } catch (err: any) {
      console.error('Failed to add subscription:', err);
      // Show error in cart message so user knows it failed
      setCartMsg(err.message || 'Failed to add subscription. Please try again.');
    } finally { setAdding(false); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Inline brand picker */}
      {showPicker && <BrandPicker onSelect={handleAdd} onCancel={() => setShowPicker(false)} />}

      <FadeIn>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-light-bg transition"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold text-dark flex items-center gap-2">
              <Bell size={20} className="text-violet-500" />
              My Subscriptions
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Items auto-added to your cart on their due date
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowPicker(true)}
            loading={adding}
            leftIcon={<Plus size={14} />}
          >
            Add item
          </Button>
        </div>

        {/* Due today banner */}
        {dueCount > 0 && dueCart && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                <Bell size={14} /> {dueCount} item{dueCount > 1 ? 's' : ''} due for tomorrow's delivery
              </p>
              <p className="text-xs text-amber-600 mt-0.5 truncate">
                Order now → delivered tomorrow morning
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => { ctx.setCart(dueCart); ctx.setCartOpen(true); }}
            >
              Add to cart
            </Button>
          </div>
        )}

        {/* Subscriptions list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="bg-light-bg rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={28} className="text-violet-500" />
            </div>
            <h2 className="text-lg font-semibold text-dark mb-2">No subscriptions yet</h2>
            <p className="text-sm text-muted mb-5 max-w-xs mx-auto">
              Subscribe to items you buy regularly — milk, eggs, bread — and they'll auto-add to your cart on schedule.
            </p>
            <Button
              variant="primary"
              onClick={() => setShowPicker(true)}
              leftIcon={<Plus size={16} />}
            >
              Set up a subscription
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map(sub => {
              const isDue = sub.next_due_date <= today;
              return (
                <div
                  key={sub.product_id}
                  className={`bg-surface border rounded-2xl p-4 flex items-start gap-4 ${
                    isDue ? 'border-amber-300 bg-amber-50/40' : 'border-border'
                  }`}
                >
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle size={20} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-dark">{sub.product_name}</p>
                      <button
                        onClick={() => handleRemove(sub.product_id)}
                        disabled={removing === sub.product_id}
                        className="p-1.5 text-muted hover:text-red-500 transition disabled:opacity-50 shrink-0"
                        aria-label={`Remove ${sub.product_name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Chip tone={freqColor(sub.frequency)} size="xs">{sub.frequency}</Chip>
                      <span className={`flex items-center gap-1 text-[11px] ${isDue ? 'text-amber-700 font-semibold' : 'text-muted'}`}>
                        <Calendar size={10} />
                        {isDue ? 'Due today' : `Next: ${sub.next_due_date}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {subscriptions.length > 0 && (
          <div className="mt-4 space-y-3">
            {/* Subscription cart card */}
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-sm font-bold text-dark mb-1 flex items-center gap-2">
                <ShoppingCart size={15} className="text-primary-ink" /> Order Now
              </p>
              <p className="text-xs text-muted mb-3">
                Ordering today means delivery arrives tomorrow morning. Items due today or tomorrow are added to cart automatically — others are included so you can order everything at once.
              </p>

              {/* In-app message — replaces alert() */}
              {cartMsg && (
                <div className={`text-xs rounded-xl px-3 py-2 mb-3 ${
                  cartMsg.startsWith('✓')
                    ? 'bg-primary-light text-primary-ink'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {cartMsg}
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                className="w-full"
                loading={addingToCart}
                onClick={async () => {
                  setAddingToCart(true);
                  setCartMsg('');
                  try {
                    // Step 1: Try due/tomorrow items first (order now = delivery tomorrow morning)
                    const dueData = await getDueSubscriptions(userId);
                    if (dueData.cart && (dueData.due_count ?? 0) > 0) {
                      ctx.setCart(dueData.cart);
                      ctx.setCartOpen(true);
                      setCartMsg(`✓ ${dueData.cart.items.length} item${dueData.cart.items.length > 1 ? 's' : ''} added — order now for tomorrow morning delivery`);
                      return;
                    }
                    // Step 2: Nothing due in delivery window — add all subscriptions anyway
                    const result = await getAllSubscriptionsCart(userId);
                    if (result.cart) {
                      ctx.setCart(result.cart);
                      ctx.setCartOpen(true);
                      setCartMsg(`✓ ${result.cart.items.length} subscribed item${result.cart.items.length > 1 ? 's' : ''} added to cart`);
                    } else {
                      setCartMsg(result.message || 'Could not build cart from subscriptions.');
                    }
                  } catch {
                    setCartMsg('Failed to build cart. Please try again.');
                  } finally {
                    setAddingToCart(false);
                  }
                }}
                leftIcon={<ShoppingCart size={15} />}
              >
                Order subscriptions now
              </Button>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-violet-700">
                🔔 Subscribed items also auto-add on their due date.
                You always review and confirm before checkout.
              </p>
            </div>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
