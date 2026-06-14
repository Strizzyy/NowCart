import { useState } from 'react';
import { Clock, Package, TrendingUp, ShoppingCart, Sparkles } from 'lucide-react';
import { getPredictedCart, getUserPantry, type PredictResponse, type PantryItem } from '../../../api/client';
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
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState('');
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryLoading, setPantryLoading] = useState(false);

  const userId = resolveUserId(ctx.user);

  const handlePredict = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPredictedCart(userId);
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

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
            <Sparkles size={16} className="text-violet-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-violet-900">Zero Door — Predictive Restock</p>
            <p className="text-xs text-violet-600">We know what you need before you ask</p>
          </div>
        </div>
        <p className="text-xs text-violet-700 mt-2">
          Based on your purchase patterns, we predict when you'll run out of essentials and 
          pre-build a restock cart — already optimized, substituted, and scored.
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

      {result?.cart && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={16} className="text-green-700" />
            <p className="text-sm font-bold text-green-800">
              {result.message}
            </p>
          </div>
          <div className="space-y-2 mt-3">
            {result.cart.items.slice(0, 5).map((item) => (
              <div key={item.product_id} className="flex items-center justify-between bg-white/70 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-green-600" />
                  <span className="text-xs font-medium text-dark">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="success" size="xs">{Math.round(item.confidence * 100)}%</Chip>
                  <span className="text-xs text-muted">₹{item.price}</span>
                </div>
              </div>
            ))}
            {result.cart.items.length > 5 && (
              <p className="text-xs text-green-600 text-center">
                +{result.cart.items.length - 5} more items in your restock cart
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pantry Awareness Section */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-dark flex items-center gap-1.5">
            <Package size={14} className="text-emerald-600" /> Pantry Awareness
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadPantry}
            loading={pantryLoading}
          >
            {pantryLoading ? 'Loading...' : pantry.length > 0 ? 'Refresh' : 'Show my pantry'}
          </Button>
        </div>
        <p className="text-xs text-muted mb-2">
          Items we think you still have at home (based on recent purchases + estimated shelf life).
          These are auto-filtered from your cart when you use any front door.
        </p>
        {pantry.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {pantry.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between bg-emerald-50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🏠</span>
                  <span className="text-xs font-medium text-dark">{item.product_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={item.estimated_remaining_days > 5 ? 'success' : 'warning'} size="xs">
                    ~{Math.round(item.estimated_remaining_days)}d left
                  </Chip>
                  <span className="text-[10px] text-muted">{Math.round(item.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
