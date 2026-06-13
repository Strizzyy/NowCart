import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Star, Truck, Shield } from 'lucide-react';
import type { AppContext } from '../App';
import { searchCatalog, postCartOp, postOutcome } from '../api/client';
import type { Product } from '../api/client';
import ProductCard from '../components/ProductCard';

interface Props {
  ctx: AppContext;
}

export default function ProductPage({ ctx }: Props) {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Search for the product by ID (search all and filter)
        const all = await searchCatalog(undefined, undefined, 100);
        const found = all.find((p) => p.product_id === id);
        setProduct(found || null);

        if (found) {
          const rel = all
            .filter((p) => p.category === found.category && p.product_id !== found.product_id)
            .slice(0, 4);
          setRelated(rel);
        }
      } catch (err) {
        console.error('Failed to load product:', err);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    if (ctx.cart) {
      try {
        const updated = await postCartOp(ctx.cart.session_id, 'add', product.name, quantity);
        ctx.setCart(updated);
        ctx.setCartOpen(true);
      } catch { /* ignore */ }
    } else {
      try {
        const cart = await postOutcome(product.name);
        ctx.setCart(cart);
        ctx.setCartOpen(true);
      } catch { /* ignore */ }
    }
  };

  const handleAddRelated = async (p: Product) => {
    if (ctx.cart) {
      try {
        const updated = await postCartOp(ctx.cart.session_id, 'add', p.name, 1);
        ctx.setCart(updated);
        ctx.setCartOpen(true);
      } catch { /* ignore */ }
    } else {
      try {
        const cart = await postOutcome(p.name);
        ctx.setCart(cart);
        ctx.setCartOpen(true);
      } catch { /* ignore */ }
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse grid md:grid-cols-2 gap-8">
          <div className="bg-light-bg rounded-xl h-80" />
          <div className="space-y-4">
            <div className="bg-light-bg h-8 w-3/4 rounded" />
            <div className="bg-light-bg h-6 w-1/2 rounded" />
            <div className="bg-light-bg h-12 w-1/3 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <span className="text-5xl block mb-4">😕</span>
        <h2 className="font-heading font-bold text-2xl text-dark mb-2">Product not found</h2>
        <Link to="/shop" className="text-primary hover:underline">Back to shop →</Link>
      </div>
    );
  }

  const discount = product.market_price > product.sale_price
    ? Math.round((1 - product.sale_price / product.market_price) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-primary">Shop</Link>
        <span>/</span>
        <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-primary">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-dark">{product.name}</span>
      </div>

      {/* Product detail */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Image */}
        <div className="bg-light-bg rounded-2xl p-8 flex items-center justify-center relative">
          {discount > 0 && (
            <span className="absolute top-4 left-4 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
              {discount}% OFF
            </span>
          )}
          <span className="text-8xl">🥬</span>
        </div>

        {/* Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">
            {product.name}
          </h1>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < Math.round(product.rating!) ? 'fill-secondary text-secondary' : 'text-gray-200'}
                  />
                ))}
              </div>
              <span className="text-sm text-muted">({product.rating.toFixed(1)})</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold text-primary">₹{product.sale_price.toFixed(0)}</span>
            {product.market_price > product.sale_price && (
              <span className="text-lg text-muted line-through">₹{product.market_price.toFixed(0)}</span>
            )}
          </div>

          {/* Meta */}
          <div className="space-y-2 mb-6 text-sm">
            <p><span className="text-muted">Brand:</span> <span className="font-medium">{product.brand}</span></p>
            <p><span className="text-muted">Category:</span> <span className="font-medium">{product.category}</span></p>
            <p><span className="text-muted">Unit:</span> <span className="font-medium">{product.unit}</span></p>
            <p>
              <span className="text-muted">Availability:</span>{' '}
              {product.in_stock ? (
                <span className="text-primary font-medium">In Stock</span>
              ) : (
                <span className="text-accent font-medium">Out of Stock</span>
              )}
            </p>
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-border rounded-md">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 hover:bg-light-bg transition"
              >
                −
              </button>
              <span className="px-4 py-2 font-medium border-x border-border">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-2 hover:bg-light-bg transition"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!product.in_stock}
              className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-md font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Truck size={16} className="text-primary" />
              <span>{product.delivery_eta_min} min delivery</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Shield size={16} className="text-primary" />
              <span>Quality guaranteed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section>
          <h2 className="text-xl font-heading font-bold text-dark mb-4">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.product_id} product={p} onAddToCart={handleAddRelated} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
