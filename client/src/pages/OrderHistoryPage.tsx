import { useState, useEffect } from 'react';
import { Package, Calendar, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AppContext } from '../App';
import { getOrderHistory, type OrderRecord } from '../api/client';
import { Button, Spinner, FadeIn } from '../ui';

interface Props {
  ctx: AppContext;
}

/** Map logged-in user email to backend user_id */
function resolveUserId(ctx: AppContext): string {
  if (ctx.user?.userId) return ctx.user.userId;
  const email = ctx.user?.email;
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

export default function OrderHistoryPage({ ctx }: Props) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = resolveUserId(ctx);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await getOrderHistory(userId);
        setOrders(data.orders || []);
      } catch (e: any) {
        setError(e.message || 'Failed to load order history');
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <FadeIn>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="p-2 rounded-lg hover:bg-light-bg transition">
            <ArrowLeft size={20} className="text-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-dark">Order History</h1>
            <p className="text-sm text-muted">
              {orders.length} order{orders.length !== 1 ? 's' : ''} for {ctx.user?.name || 'User'} (ID: {userId})
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={48} className="mx-auto text-muted mb-4" />
            <h2 className="text-lg font-semibold text-dark mb-2">No orders yet</h2>
            <p className="text-sm text-muted mb-4">
              Place your first order and it will appear here. Your order history powers the Subscribe predictions.
            </p>
            <Link to="/">
              <Button variant="primary" size="md">Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.order_id}
                className="bg-surface border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-primary-light rounded-lg flex items-center justify-center">
                      <Package size={18} className="text-primary-ink" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dark">{order.order_id}</p>
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Calendar size={11} />
                        {order.order_date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-ink">₹{order.total.toFixed(0)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 justify-end flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        order.status === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                      {order.payment_method && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase">
                          {order.payment_method}
                        </span>
                      )}
                      {order.payment_status && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          order.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {order.payment_status === 'paid' ? '✓ Paid' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-light-bg rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5"
                      >
                        <span className="font-medium text-dark">{item.name}</span>
                        <span className="text-muted">×{item.quantity}</span>
                        <span className="text-primary-ink font-semibold">₹{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <div className="mt-8 bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
            <p className="text-sm text-violet-700">
              🔮 Your order history feeds the <strong>Subscribe</strong> predictive engine.
              The more you order, the better we predict your restock needs.
            </p>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
