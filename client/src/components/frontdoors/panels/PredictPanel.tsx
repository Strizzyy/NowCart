import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Package, TrendingUp, ShoppingCart, Sparkles, Bell,
  Plus, Trash2, CheckCircle, Search, X, ChevronDown, ExternalLink,
} from 'lucide-react';
import {
  getSubscribedCart,
  getUserPantry,
  getUserSubscriptions,
  addSubscription,
  removeSubscription,
  getDueSubscriptions,
  getPredictionInsights,
  searchCatalog,
  type SubscribeResponse,
  type PantryItem,
  type Subscription,
  type Product,
} from '../../../api/client';
import type { AppContext } from '../../../App';
import { Button, Chip } from '../../../ui';

interface Props {
  ctx: AppContext;
}

/** Map logged-in user to backend user_id */
function resolveUserId(user: { email?: string; userId?: string } | null | undefined): string {
  if (!user) return 'user-001';
  if (user.userId) return user.userId;
  const email = user.email;
  if (!email) return 'user-001';
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

function freqLabel(freq: string) {
  if (freq === 'daily') return 'daily';
  if (freq === 'weekly') return 'weekly';
  if (freq === 'monthly') return 'monthly';
  return freq;
}

// ---------------------------------------------------------------------------
// Brand picker modal — search catalog, pick a product, set frequency
// ---------------------------------------------------------------------------
interface BrandPickerProps {
  initialQuery: string;
  onSelect: (product: Product, frequency: 'daily' | 'weekly' | 'monthly') => void;
  onCancel: () => void;
}

function BrandPicker({ initialQuery, onSelect, onCancel }: BrandPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [freq, setFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock background scroll while picker is open
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchCatalog(query, undefined, 8);
        setResults(data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-search on open
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-dark/60" onClick={onCancel} />
      <div className="relative w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        style={{ maxHeight: '92dvh' }}>
        {/* Header — shrink-0 so it never compresses */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <p className="text-sm font-bold text-dark">Choose a product to subscribe</p>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-light-bg transition">
            <X size={16} className="text-muted" />
          </button>
        </div>

        {/* Search — shrink-0 */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-light-bg">
            <Search size={14} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                // Blur immediately so keyboard dismisses while results load
                inputRef.current?.blur();
              }}
              onFocus={e => {
                // Re-select all text when user taps to edit again
                e.target.select();
              }}
              placeholder="Search products…"
              className="flex-1 text-sm bg-transparent outline-none text-dark"
              autoFocus
            />
            {searching && <span className="text-xs text-muted">…</span>}
          </div>
        </div>

        {/* Results — flex-1 + min-h-0 is the critical fix so this scrolls
            instead of expanding past the container and hiding the confirm button */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {results.length === 0 && !searching && query && (
            <p className="px-4 py-5 text-sm text-muted text-center">No products found for "{query}"</p>
          )}
          {!query && (
            <p className="px-4 py-5 text-sm text-muted text-center">Type to search — e.g. "milk", "eggs"</p>
          )}
          {results.map(p => (
            <button
              key={p.product_id}
              onClick={() => {
                inputRef.current?.blur(); // dismiss keyboard when picking a result
                setSelected(selected?.product_id === p.product_id ? null : p);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-light-bg transition text-left ${
                selected?.product_id === p.product_id ? 'bg-primary-light' : ''
              }`}
            >
              <div className="w-10 h-10 bg-light-bg rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-1"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : <span className="text-xl">📦</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-dark truncate">{p.name}</p>
                <p className="text-xs text-muted">{p.brand} · ₹{p.sale_price}</p>
              </div>
              {selected?.product_id === p.product_id && (
                <CheckCircle size={16} className="text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Frequency + Confirm — shrink-0 so it always stays visible at the bottom */}
        {selected && (
          <div className="px-4 py-3 border-t border-border space-y-3 shrink-0 bg-surface">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-dark">How often?</p>
              {(['daily', 'weekly', 'monthly'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    freq === f
                      ? 'bg-primary text-white'
                      : 'bg-light-bg text-muted hover:text-dark border border-border'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={() => onSelect(selected, freq)}
              className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark active:scale-95 transition"
            >
              Subscribe to {selected.name} · {freq}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PredictPanel
// ---------------------------------------------------------------------------
export default function PredictPanel({ ctx }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubscribeResponse | null>(null);
  const [error, setError] = useState('');
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryLoading, setPantryLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [addingSubId, setAddingSubId] = useState<string | null>(null);
  const [removingSubId, setRemovingSubId] = useState<string | null>(null);
  const [dueCart, setDueCart] = useState<SubscribeResponse['cart'] | null>(null);
  const [insights, setInsights] = useState<{ product_name: string; avg_interval_days: number; confidence: number; product_id: string }[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [pickerQuery, setPickerQuery] = useState<string | null>(null);
  const [showPantry, setShowPantry] = useState(false);
  const navigate = useNavigate();

  const userId = resolveUserId(ctx.user);

  useEffect(() => {
    loadSubscriptions();
    loadDueSubscriptions();
    loadInsights();
  }, [userId]);

  const loadSubscriptions = async () => {
    try {
      const data = await getUserSubscriptions(userId);
      setSubscriptions(data.subscriptions || []);
    } catch { /* ignore */ }
  };

  const loadDueSubscriptions = async () => {
    try {
      const data = await getDueSubscriptions(userId);
      if (data.cart && (data.due_count ?? 0) > 0) setDueCart(data.cart);
    } catch { /* ignore */ }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await getPredictionInsights(userId);
      setInsights((data.predictions || []).slice(0, 5));
    } catch { /* ignore */ }
    finally { setInsightsLoading(false); }
  };

  const loadPantry = async () => {
    setPantryLoading(true);
    try {
      const data = await getUserPantry(userId);
      setPantry(data.items || []);
    } catch { /* ignore */ }
    finally { setPantryLoading(false); }
  };

  const handlePredict = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSubscribedCart(userId);
      setResult(data);
      if (data.cart) {
        ctx.setCart(data.cart);
        ctx.setCartOpen(true);
      }
    } catch (e: any) {
      setError(e.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubscription = async (product: Product, frequency: 'daily' | 'weekly' | 'monthly') => {
    setPickerQuery(null);
    setAddingSubId(product.product_id);
    try {
      await addSubscription(userId, product.product_id, product.name, frequency);
      await loadSubscriptions();
      await loadDueSubscriptions(); // refresh due cart
    } catch (err: any) {
      console.error('Failed to add subscription:', err);
      setError(err.message || 'Failed to add subscription. Please try again.');
    } finally { setAddingSubId(null); }
  };

  const handleRemoveSubscription = async (productId: string) => {
    setRemovingSubId(productId);
    try {
      await removeSubscription(userId, productId);
      setSubscriptions(prev => prev.filter(s => s.product_id !== productId));
    } catch { /* ignore */ }
    finally { setRemovingSubId(null); }
  };

  const isSubscribed = (productId: string) => subscriptions.some(s => s.product_id === productId);

  // Quick-start suggestions for new users
  const quickSuggestions = [
    { label: 'Milk', emoji: '🥛', q: 'full cream milk' },
    { label: 'Eggs', emoji: '🥚', q: 'eggs' },
    { label: 'Bread', emoji: '🍞', q: 'bread' },
    { label: 'Curd', emoji: '🍶', q: 'curd' },
    { label: 'Atta', emoji: '🌾', q: 'wheat flour atta' },
  ];

  return (
    <div className="space-y-4">
      {/* Brand picker overlay */}
      {pickerQuery !== null && (
        <BrandPicker
          initialQuery={pickerQuery}
          onSelect={handleConfirmSubscription}
          onCancel={() => setPickerQuery(null)}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-violet-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-violet-900">Subscribe — Predicted Restock</p>
            <p className="text-xs text-violet-600">We know what you need before you ask</p>
          </div>
        </div>
        <p className="text-xs text-violet-700 mt-2">
          {insights.length > 0
            ? 'Based on your order history, we predict your restock needs and let you set recurring schedules.'
            : 'New here? Get a starter cart based on your profile, or set up recurring items below.'}
        </p>
      </div>

      {/* Due today alert */}
      {dueCart && dueCart.items.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <Bell size={12} /> {dueCart.items.length} recurring item{dueCart.items.length > 1 ? 's' : ''} due today
            </p>
            <p className="text-[11px] text-amber-600 truncate mt-0.5">
              {dueCart.items.slice(0, 3).map(i => i.name).join(', ')}
              {dueCart.items.length > 3 ? ` +${dueCart.items.length - 3} more` : ''}
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => { ctx.setCart(dueCart); ctx.setCartOpen(true); }}>
            Add to cart
          </Button>
        </div>
      )}

      {/* Predicted restock button */}
      <Button variant="primary" size="md" onClick={handlePredict} loading={loading}
        leftIcon={<TrendingUp size={16} />} className="w-full">
        {loading ? 'Analyzing your patterns…' : 'Show my predicted restock'}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>
      )}

      {result && !result.cart && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <Package size={24} className="mx-auto text-amber-600 mb-2" />
          <p className="text-sm font-medium text-amber-800">{result.message}</p>
          <p className="text-xs text-amber-600 mt-1">
            {insights.length === 0
              ? 'No order history yet — but we built a starter cart from your profile above. Set up recurring items below to get started!'
              : "Order a few more times and we'll learn your patterns."}
          </p>
        </div>
      )}

      {result?.cart && (() => {
        const isStarter = result.cart!.notes?.some(n => n.includes('Starter essentials'));
        return (
          <div className={`border rounded-xl p-4 ${isStarter ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
            {isStarter && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full mb-2 inline-block">
                Starter cart · based on your profile
              </span>
            )}
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={16} className={isStarter ? 'text-blue-700' : 'text-green-700'} />
              <p className={`text-sm font-bold ${isStarter ? 'text-blue-800' : 'text-green-800'}`}>{result.message}</p>
            </div>
            {isStarter && (
              <p className="text-xs text-blue-700 mb-2">
                Personalised from your age, gender &amp; region. Order a few times and we'll switch to pattern-based predictions.
              </p>
            )}
            <div className="space-y-1.5">
              {result.cart!.items.slice(0, 5).map(item => (
                <div key={item.product_id} className={`flex items-center justify-between rounded-lg p-2 ${isStarter ? 'bg-blue-100/60' : 'bg-white/70'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={11} className={isStarter ? 'text-blue-500' : 'text-green-500'} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-dark truncate">{item.name}</p>
                      <p className="text-[10px] text-muted">{item.brand}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-dark">₹{item.price}</span>
                  </div>
                </div>
              ))}
              {result.cart!.items.length > 5 && (
                <p className={`text-xs text-center pt-1 ${isStarter ? 'text-blue-600' : 'text-green-600'}`}>
                  +{result.cart!.items.length - 5} more items in your cart
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recurring Schedules ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-light-bg border-b border-border">
          <button
            onClick={() => navigate('/subscriptions')}
            className="text-sm font-bold text-dark flex items-center gap-1.5 hover:text-primary-ink transition"
          >
            <Bell size={14} className="text-violet-500" /> My Subscriptions
            <ExternalLink size={11} className="text-muted ml-0.5" />
          </button>
          <button
            onClick={() => setPickerQuery('')}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition"
          >
            <Plus size={13} /> Add item
          </button>
        </div>

        {/* Active subscriptions list */}
        {subscriptions.length > 0 ? (
          <div className="divide-y divide-border">
            {subscriptions.map(sub => (
              <div key={sub.product_id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle size={14} className="text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark truncate">{sub.product_name}</p>
                  <p className="text-[11px] text-muted">
                    Auto-added <span className="font-medium text-violet-600">{freqLabel(sub.frequency)}</span>
                    {' · '}next: {sub.next_due_date}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveSubscription(sub.product_id)}
                  disabled={removingSubId === sub.product_id}
                  className="p-1.5 text-muted hover:text-red-500 transition disabled:opacity-50 shrink-0"
                  aria-label={`Remove ${sub.product_name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-muted mb-1">No subscriptions yet.</p>
            <p className="text-xs text-muted">Subscribe to items below and they'll auto-add to your cart when due.</p>
          </div>
        )}
      </div>

      {/* ── Smart suggestions from order history ── */}
      {insightsLoading ? (
        <div className="px-1 py-2">
          <div className="h-3 w-40 bg-border rounded animate-pulse mb-2" />
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-light-bg rounded-xl animate-pulse" />)}
          </div>
        </div>
      ) : insights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-dark px-1">💡 Based on your order history:</p>
          {insights.filter(ins => !isSubscribed(ins.product_id)).map(ins => {
            const freq = ins.avg_interval_days <= 3 ? 'daily'
                       : ins.avg_interval_days <= 10 ? 'weekly'
                       : 'monthly';
            return (
              <div key={ins.product_id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dark truncate">{ins.product_name}</p>
                  <p className="text-[11px] text-green-700">
                    You order every ~{Math.round(ins.avg_interval_days)}d — add <strong>{freq}</strong>?
                  </p>
                </div>
                <button
                  onClick={() => setPickerQuery(ins.product_name)}
                  disabled={addingSubId === ins.product_id}
                  className="shrink-0 flex items-center gap-1 bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-dark active:scale-95 transition ml-3 disabled:opacity-60"
                >
                  <Plus size={11} /> Choose brand
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Quick-start for new users (no history) ── */
        <div className="space-y-2">
          <p className="text-xs font-semibold text-dark px-1">✨ Quick-start — pick a brand:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickSuggestions.map(sug => (
              <button
                key={sug.q}
                onClick={() => setPickerQuery(sug.q)}
                className="flex flex-col items-center gap-1.5 bg-light-bg border border-border hover:border-primary/40 hover:bg-primary-light/40 rounded-xl p-3 transition active:scale-95 text-center"
              >
                <span className="text-2xl">{sug.emoji}</span>
                <span className="text-xs font-semibold text-dark">{sug.label}</span>
                <span className="text-[10px] text-muted">Tap to pick brand</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Recently Ordered (collapsible) ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => { setShowPantry(v => !v); if (!showPantry && pantry.length === 0) loadPantry(); }}
          className="w-full flex items-center justify-between px-4 py-3 bg-light-bg hover:bg-primary-light/30 transition"
        >
          <p className="text-sm font-bold text-dark flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" /> Recently Ordered
          </p>
          <div className="flex items-center gap-2">
            {pantryLoading && <span className="text-xs text-muted">Loading…</span>}
            <ChevronDown size={14} className={`text-muted transition-transform ${showPantry ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {showPantry && (
          <div className="px-4 py-3">
            <p className="text-xs text-muted mb-2">Items ordered in the last 30 days — marked in your cart with a "still need it?" prompt.</p>
            {pantry.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pantry.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-dark truncate">{item.name}</span>
                    <Chip tone={item.days_ago <= 7 ? 'warning' : 'info'} size="xs">{item.days_ago}d ago</Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic">
                {pantryLoading ? 'Loading…' : 'No recent orders found.'}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted text-center pb-1">
        Subscribed items auto-add to your cart on their due date. You confirm before checkout.
      </p>
    </div>
  );
}
