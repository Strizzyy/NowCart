import { useState } from 'react';
import { Zap, Clock, ShieldCheck, Star, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AppContext } from '../App';
import { postSosRecommend, postCartOp } from '../api/client';
import type { SosRecommendation, CartResponse } from '../api/client';
import { Button, Card, Chip, Spinner, ErrorState } from '../ui';

interface Props {
  ctx: AppContext;
}

const QUICK_SITUATIONS = [
  { label: '🎉 Guests in 30 min', value: 'unexpected guests arriving in 30 minutes' },
  { label: '🤒 Fever at home', value: 'child has a fever, need basics' },
  { label: '👶 Baby supplies', value: 'baby supplies running out urgently' },
  { label: '🌧️ Stuck in', value: 'heavy rain, need essentials for 2 days' },
  { label: '🎊 Party tonight', value: 'hosting a party tonight for 8 people' },
  { label: '📦 Weekly restock', value: 'weekly essentials restock for family of 4' },
];

/** Check if a product is currently in the cart by matching product name */
function getCartItem(cart: CartResponse | null, productName: string) {
  if (!cart) return null;
  return cart.items.find(
    (item) => item.name.toLowerCase() === productName.toLowerCase()
  ) ?? null;
}

function RecommendationCard({
  rec,
  ctx,
  onAdd,
  onRemove,
  onQuantityChange,
}: {
  rec: SosRecommendation;
  ctx: AppContext;
  onAdd: (rec: SosRecommendation) => void;
  onRemove: (productName: string) => void;
  onQuantityChange: (productName: string, qty: number) => void;
}) {
  const { product, reason, quantity } = rec;
  const discount = product.market_price > product.sale_price
    ? Math.round((1 - product.sale_price / product.market_price) * 100)
    : 0;

  // Sync with actual cart state
  const cartItem = getCartItem(ctx.cart, product.name);
  const isInCart = !!cartItem;

  return (
    <Card padding="md" className="hover:shadow-[var(--shadow-pop)] transition-all">
      <div className="flex gap-4">
        {/* Product image */}
        <Link to={`/product/${product.product_id}`} className="shrink-0">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-light-bg rounded-xl flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain p-2"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-4xl">📦</span>';
                }}
              />
            ) : (
              <span className="text-4xl" aria-hidden="true">📦</span>
            )}
          </div>
        </Link>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {discount > 0 && <Chip tone="accent" size="xs">{discount}% OFF</Chip>}
            {!product.in_stock && <Chip tone="neutral" size="xs">Out of stock</Chip>}
            {isInCart && <Chip tone="success" size="xs" icon={<ShoppingCart size={10} />}>In Cart</Chip>}
          </div>

          {/* Name */}
          <Link to={`/product/${product.product_id}`}>
            <h3 className="text-base font-heading font-bold text-dark hover:text-primary-ink transition mb-0.5 line-clamp-2">
              {product.name}
            </h3>
          </Link>

          {/* Brand & unit */}
          <p className="text-xs text-muted mb-1">{product.brand} · {product.unit}</p>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-1 mb-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < Math.round(product.rating!) ? 'fill-secondary text-secondary' : 'text-gray-200'}
                  aria-hidden="true"
                />
              ))}
              <span className="text-[11px] text-muted ml-0.5">({product.rating.toFixed(1)})</span>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-xs text-muted line-clamp-1 mb-2">{product.description}</p>
          )}

          {/* Reason for recommendation */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Why:</span> {reason}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Suggested qty: {quantity}</p>
          </div>

          {/* Price + Cart controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-primary-ink">₹{product.sale_price.toFixed(0)}</span>
              {product.market_price > product.sale_price && (
                <span className="text-xs text-muted line-through">₹{product.market_price.toFixed(0)}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link to={`/product/${product.product_id}`}>
                <Button variant="outline" size="sm">Details</Button>
              </Link>

              {isInCart ? (
                /* Quantity controls + Remove when in cart */
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onQuantityChange(product.name, Math.max(1, cartItem.quantity - 1))}
                    className="w-8 h-8 rounded-full bg-light-bg border border-border flex items-center justify-center hover:border-primary transition"
                    aria-label={`Decrease ${product.name} quantity`}
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span className="text-sm font-semibold w-6 text-center">{cartItem.quantity}</span>
                  <button
                    onClick={() => onQuantityChange(product.name, cartItem.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-light-bg border border-border flex items-center justify-center hover:border-primary transition"
                    aria-label={`Increase ${product.name} quantity`}
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => onRemove(product.name)}
                    className="w-8 h-8 rounded-full bg-red-50 border border-red-200 flex items-center justify-center hover:bg-red-100 transition text-red-600"
                    aria-label={`Remove ${product.name} from cart`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                /* Add to Cart button when not in cart */
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onAdd(rec)}
                  disabled={!product.in_stock}
                  leftIcon={<ShoppingCart size={14} aria-hidden="true" />}
                >
                  Add to Cart
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SosPage({ ctx }: Props) {
  const [situation, setSituation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<SosRecommendation[]>([]);
  const [situationText, setSituationText] = useState('');

  const triggerSos = async (sit: string) => {
    setLoading(true);
    setError(null);
    setRecommendations([]);
    setSituationText(sit);
    try {
      const result = await postSosRecommend(sit);
      setRecommendations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyze the situation.');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!situation.trim() || loading) return;
    triggerSos(situation.trim());
  };

  const handleAddToCart = async (rec: SosRecommendation) => {
    try {
      const sessionId = ctx.cart?.session_id || '';
      const updated = await postCartOp(sessionId, 'add', rec.product.name, rec.quantity);
      ctx.setCart(updated);
    } catch {
      /* ignore */
    }
  };

  const handleRemoveFromCart = async (productName: string) => {
    if (!ctx.cart) return;
    try {
      const updated = await postCartOp(ctx.cart.session_id, 'remove', productName);
      ctx.setCart(updated);
    } catch {
      /* ignore */
    }
  };

  const handleQuantityChange = async (productName: string, qty: number) => {
    if (!ctx.cart) return;
    try {
      const updated = await postCartOp(ctx.cart.session_id, 'update', productName, qty);
      ctx.setCart(updated);
    } catch {
      /* ignore */
    }
  };

  const handleAddAll = async () => {
    for (const rec of recommendations) {
      const inCart = getCartItem(ctx.cart, rec.product.name);
      if (!inCart) {
        await handleAddToCart(rec);
      }
    }
  };

  // Count how many recommended items are in cart
  const inCartCount = recommendations.filter(
    (rec) => !!getCartItem(ctx.cart, rec.product.name)
  ).length;

  // ---------------- Recommendations view ----------------
  if (recommendations.length > 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Urgency banner */}
        <div className="bg-accent text-white rounded-2xl p-5 mb-6 flex items-center justify-between shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <Zap size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading font-bold text-lg leading-tight">Emergency Recommendations</p>
              <p className="text-xs text-white/85">"{situationText}"</p>
            </div>
          </div>
          <Chip tone="success" size="sm" className="bg-white/20 text-white border-white/30">
            {recommendations.length} items found
          </Chip>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-lg text-dark">
            Recommended Products
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRecommendations([]); setSituationText(''); }}
            >
              New Search
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddAll}
              disabled={inCartCount === recommendations.length}
              leftIcon={<ShoppingCart size={14} />}
            >
              Add All to Cart
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted mb-4">
          Review the recommendations below. Add items you need, adjust quantity, or remove them.
        </p>

        {/* Recommendation cards */}
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.product.product_id}
              rec={rec}
              ctx={ctx}
              onAdd={handleAddToCart}
              onRemove={handleRemoveFromCart}
              onQuantityChange={handleQuantityChange}
            />
          ))}
        </div>

        {inCartCount > 0 && (
          <div className="mt-6 text-center">
            <Button variant="primary" size="lg" onClick={() => ctx.setCartOpen(true)} leftIcon={<ShoppingCart size={18} />}>
              View Cart ({inCartCount} items added)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ---------------- Situation picker ----------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap size={32} className="text-accent" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-dark mb-2">SOS Emergency Mode</h1>
        <p className="text-muted">
          Describe your situation — we'll analyze it and recommend the right products.
          You decide what to add to your cart.
        </p>
      </div>

      {error && (
        <div className="mb-5">
          <ErrorState title="Couldn't analyze the situation" description={error} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="mb-6">
        <p className="text-sm font-medium text-dark mb-3">Quick pick a situation:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {QUICK_SITUATIONS.map((qs) => (
            <button
              key={qs.value}
              onClick={() => triggerSos(qs.value)}
              disabled={loading}
              className="text-left p-3 bg-light-bg border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition text-sm disabled:opacity-50"
            >
              {qs.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="sos-situation" className="text-sm font-medium text-dark mb-2 block">
            Or describe your emergency:
          </label>
          <textarea
            id="sos-situation"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. 'My in-laws arrive in 20 minutes and I have nothing at home!'"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent resize-none h-24"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!situation.trim()}
          leftIcon={!loading ? <Zap size={18} /> : undefined}
        >
          {loading ? 'Analyzing situation…' : 'Get Recommendations'}
        </Button>
      </form>

      {loading && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Spinner size={24} />
          <p className="text-sm text-muted">Analyzing your situation and finding the best products...</p>
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <Card padding="md" className="flex items-start gap-3">
          <Clock size={20} className="text-accent-dark shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-dark">Smart analysis</p>
            <p className="text-xs text-muted">AI analyzes your situation and picks the most relevant products.</p>
          </div>
        </Card>
        <Card padding="md" className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-primary-ink shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-dark">You decide</p>
            <p className="text-xs text-muted">Review recommendations and add only what you need to your cart.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
