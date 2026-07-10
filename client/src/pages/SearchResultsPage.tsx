import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Layers, ArrowLeft, Star } from 'lucide-react';
import type { AppContext } from '../App';
import { searchRecommend, postCartOp } from '../api/client';
import type { Product } from '../api/client';
import { Button, Card, Chip } from '../ui';
import NowCartVerified from '../components/NowCartVerified';

interface Props {
  ctx: AppContext;
}

function ProductResultCard({ product, isBest, onAdd }: {
  product: Product;
  isBest?: boolean;
  onAdd: (p: Product) => void;
}) {
  const discount = product.market_price > product.sale_price
    ? Math.round((1 - product.sale_price / product.market_price) * 100)
    : 0;

  return (
    <Card padding="md" className={`${isBest ? 'border-2 border-primary/40 bg-primary-light/20' : ''} hover:shadow-[var(--shadow-pop)] transition-all`}>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to={`/product/${product.product_id}`} className="shrink-0">
          <div className="w-full sm:w-36 h-36 bg-light-bg rounded-xl flex items-center justify-center overflow-hidden transition">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain p-2"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-5xl">📦</span>';
                }}
              />
            ) : (
              <span className="text-5xl" aria-hidden="true">📦</span>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isBest && <NowCartVerified size="sm" />}
            {discount > 0 && <Chip tone="accent" size="xs">{discount}% OFF</Chip>}
            {!product.in_stock && <Chip tone="neutral" size="xs">Out of stock</Chip>}
          </div>

          <Link to={`/product/${product.product_id}`}>
            <h3 className="text-lg font-heading font-bold text-dark hover:text-primary-ink transition mb-1">
              {product.name}
            </h3>
          </Link>

          <p className="text-sm text-muted mb-2">{product.brand} · {product.category} · {product.unit}</p>

          {product.rating && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < Math.round(product.rating!) ? 'fill-secondary text-secondary' : 'text-gray-200'}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="text-xs text-muted">({product.rating.toFixed(1)})</span>
            </div>
          )}

          {product.description && (
            <p className="text-sm text-muted mb-3 line-clamp-2">{product.description}</p>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary-ink">₹{product.sale_price.toFixed(0)}</span>
              {product.market_price > product.sale_price && (
                <span className="text-sm text-muted line-through">₹{product.market_price.toFixed(0)}</span>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Link to={`/product/${product.product_id}`} className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" fullWidth>View Details</Button>
              </Link>
              <Button
                variant={isBest ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onAdd(product)}
                disabled={!product.in_stock}
                leftIcon={<ShoppingCart size={14} />}
                className="flex-1 sm:flex-initial"
              >
                <span className="hidden sm:inline">Add to Cart</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SearchResultsPage({ ctx }: Props) {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [best, setBest] = useState<Product | null>(null);
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) { setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        const result = await searchRecommend(query, 6);
        setBest(result.best);
        setAlternatives(result.alternatives);
      } catch (err) {
        console.error('Search recommend failed:', err);
      }
      setLoading(false);
    }
    load();
  }, [query]);

  const handleAddToCart = async (product: Product) => {
    try {
      const sessionId = ctx.cart?.session_id || '';
      const updated = await postCartOp(sessionId, 'add', product.name, 1);
      ctx.setCart(updated);
      ctx.setCartOpen(true);
    } catch { /* ignore */ }
  };

  if (!query) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="font-heading font-bold text-2xl text-dark mb-2">Search for a product</h2>
        <p className="text-muted">Use the search bar above to find products</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <button onClick={() => navigate(-1)} className="hover:text-primary flex items-center gap-1">
          <ArrowLeft size={14} /> Back
        </button>
        <span>/</span>
        <span className="text-dark">Search results for "{query}"</span>
      </div>

      <h1 className="text-2xl font-heading font-bold text-dark mb-6">
        Results for "<span className="text-primary-ink">{query}</span>"
      </h1>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-light-bg rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : !best && alternatives.length === 0 ? (
        <div className="text-center py-16">
          <h3 className="font-heading font-bold text-xl text-dark mb-2">No products found</h3>
          <p className="text-muted text-sm mb-4">We couldn't find any products matching "{query}"</p>
          <Link to="/shop"><Button variant="primary">Browse all products</Button></Link>
        </div>
      ) : (
        <div className="space-y-6">
          {best && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <NowCartVerified size="md" />
                <span className="text-xs text-muted">Most ordered in this category last month</span>
              </div>
              <ProductResultCard product={best} isBest onAdd={handleAddToCart} />
            </section>
          )}

          {alternatives.length > 0 && (
            <section>
              <h2 className="text-base font-heading font-bold text-dark mb-3 flex items-center gap-2">
                <Layers size={18} /> Alternatives
              </h2>
              <div className="space-y-3">
                {alternatives.map((product) => (
                  <ProductResultCard key={product.product_id} product={product} onAdd={handleAddToCart} />
                ))}
              </div>
            </section>
          )}

          <p className="text-center text-sm text-muted pt-4">
            Tap "Add to Cart" on the product you want, or "View Details" to learn more.
          </p>
        </div>
      )}
    </div>
  );
}
