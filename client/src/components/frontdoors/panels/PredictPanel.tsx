import { useState } from 'react';
import { Clock, Package, TrendingUp, ShoppingCart, Sparkles, Bell, Calendar } from 'lucide-react';
import {
  getSubscribedCart,
  getUserPantry,
  getUserSubscriptions,
  type SubscribeResponse,
  type PantryItem,
  type Subscription,
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

export default function PredictPanel({ ctx }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubscribeResponse | null>(null);
  const [error, setError] = useState('');
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryLoading, setPantryLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const userId = resolveUserId(ctx.user);

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

  const handleLoadPantry = async () => {
    setPantryLoading(true);
    try {
      const data = await getUserPantry(userId);
      setPantry(data.items || []);
    } catch {
      // ignore
    } finally {
      setPantryLoading(false);
    }
  };

  const handleLoadSubscriptions = async () => {
    setSubsLoading(true);
    try {
      const data = await getUserSubscriptions(userId);
      setSubscriptions(data.subscriptions || []);
    } catch {
      // ignore
    } finally {
      setSubsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
            <Sparkles size={16} className="text-violet-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-violet-900">Subscribe — Predicted Restock</p>
            <p className="text-xs text-violet-600">We know what you need before you ask</p>
          </div>
        </div>
        <p className="text-xs text-violet-700 mt-2">
          Based on your purchase patterns, we predict when you'll run out of essentials and
          pre-build a restock cart — already scored and ready to checkout.
        </p>
        <p className="text-[11px] text-violet-500 mt-1">
          Logged in as: <span className="font-semibold">{ctx.user?.name || 'Unknown'}</span> (ID: {userId})
        </p>
      </div>

      <Button
        variant="primary"
        size="md"
        onClick={handlePredict}
        loading={loading}
        leftIcon={<TrendingUp size={16} />}
        className="w-full"
      >
        {loading ? 'Analyzing your patterns...' : 'Show my predicted restock'}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {result && !result.cart && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <Package size={24} className="mx-auto text-amber-600 mb-2" />
          <p className="text-sm font-medium text-amber-800">{result.message}</p>
          <p className="text-xs text-amber-600 mt-1">
            Order a few more times and we'll learn your patterns.
          </p>
        </div>
      )}

      {result?.cart && (() => {
        const isStarter = result.cart!.notes?.some(n => n.includes('Starter essentials'));
        const bgClass = isStarter ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
        const iconColor = isStarter ? 'text-blue-700' : 'text-green-700';
        const textColor = isStarter ? 'text-blue-800' : 'text-green-800';
        const chipTone = isStarter ? 'info' : 'success';
        const chipColor = isStarter ? 'text-blue-600' : 'text-green-600';
        const dotColor = isStarter ? 'bg-blue-100 text-blue-700' : 'bg-white/70';
        return (
          <div className={`border rounded-xl p-4 ${bgClass}`}>
            {isStarter && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                  New user · Starter cart
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={16} className={iconColor} />
              <p className={`text-sm font-bold ${textColor}`}>{result.message}</p>
            </div>
            {isStarter && (
              <p className="text-xs text-blue-700 mb-2">
                Personalised from your age, gender &amp; region. Order a few times and we'll switch to pattern-based predictions.
              </p>
            )}
            <div className="space-y-2 mt-1">
              {result.cart!.items.slice(0, 5).map((item) => (
                <div key={item.product_id} className={`flex items-center justify-between rounded-lg p-2 ${dotColor}`}>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className={chipColor} />
                    <span className="text-xs font-medium text-dark">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={chipTone as any} size="xs">{Math.round(item.confidence * 100)}%</Chip>
                    <span className="text-xs text-muted">₹{item.price}</span>
                  </div>
                </div>
              ))}
              {result.cart!.items.length > 5 && (
                <p className={`text-xs text-center ${chipColor}`}>
                  +{result.cart!.items.length - 5} more items in your cart
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Recently Ordered section */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-dark flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" /> Recently Ordered
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadPantry}
            loading={pantryLoading}
          >
            {pantry.length > 0 ? 'Refresh' : 'Show recent'}
          </Button>
        </div>
        <p className="text-xs text-muted mb-2">
          Products you've ordered in the last 30 days. These are marked in your cart with a
          "You ordered this X days ago — still need it?" prompt.
        </p>
        {pantry.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {pantry.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between bg-blue-50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🛒</span>
                  <span className="text-xs font-medium text-dark font-mono">{item.product_id}</span>
                </div>
                <Chip tone={item.days_ago <= 7 ? 'warning' : 'info'} size="xs">
                  {item.days_ago}d ago
                </Chip>
              </div>
            ))}
          </div>
        )}
        {pantry.length === 0 && !pantryLoading && (
          <p className="text-xs text-muted italic">No recent orders found.</p>
        )}
      </div>

      {/* Recurring Subscriptions section */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-dark flex items-center gap-1.5">
            <Bell size={14} className="text-violet-500" /> Recurring Schedules
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadSubscriptions}
            loading={subsLoading}
          >
            {subscriptions.length > 0 ? 'Refresh' : 'View schedules'}
          </Button>
        </div>
        <p className="text-xs text-muted mb-2">
          Set daily, weekly, or monthly subscriptions for products you always need.
        </p>
        {subscriptions.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {subscriptions.map((sub) => (
              <div key={sub.product_id} className="flex items-center justify-between bg-violet-50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-violet-600" />
                  <span className="text-xs font-medium text-dark">{sub.product_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="primary" size="xs">{sub.frequency}</Chip>
                  <span className="text-[10px] text-muted">due {sub.next_due_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {subscriptions.length === 0 && !subsLoading && (
          <p className="text-xs text-muted italic">No recurring subscriptions set up yet.</p>
        )}
      </div>
    </div>
  );
}
