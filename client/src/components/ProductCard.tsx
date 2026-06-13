import { ShoppingCart, Star } from 'lucide-react';
import type { Product } from '../api/client';
import { Link } from 'react-router-dom';
import { Card, Chip } from '../ui';

interface Props {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart }: Props) {
  const discount = product.market_price > product.sale_price
    ? Math.round((1 - product.sale_price / product.market_price) * 100)
    : 0;

  return (
    <Card padding="sm" className="group flex flex-col hover:border-primary/40 hover:shadow-[var(--shadow-pop)] transition-all duration-200">
      {/* Badges */}
      <div className="flex gap-1.5 mb-2 min-h-[1.25rem]">
        {discount > 0 && <Chip tone="accent" size="xs">{discount}% OFF</Chip>}
        {!product.in_stock && <Chip tone="neutral" size="xs">Out of stock</Chip>}
      </div>

      {/* Image placeholder */}
      <Link to={`/product/${product.product_id}`} aria-label={product.name}>
        <div className="w-full h-32 bg-light-bg rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary-light/60 transition">
          <span className="text-4xl" aria-hidden="true">🥬</span>
        </div>
      </Link>

      {/* Category */}
      <p className="text-[10px] text-muted uppercase tracking-wide mb-1">{product.category}</p>

      {/* Name */}
      <Link to={`/product/${product.product_id}`}>
        <h3 className="text-sm font-semibold text-dark line-clamp-2 hover:text-primary-ink transition mb-1 min-h-[2.5rem]">
          {product.name}
        </h3>
      </Link>

      {/* Rating */}
      {product.rating && (
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={12}
              className={i < Math.round(product.rating!) ? 'fill-secondary text-secondary' : 'text-border'}
              aria-hidden="true"
            />
          ))}
          <span className="text-[10px] text-muted ml-1">({product.rating.toFixed(1)})</span>
        </div>
      )}

      {/* Brand & unit */}
      <p className="text-xs text-muted mb-3">{product.brand} · {product.unit}</p>

      {/* Price + Add */}
      <div className="flex items-center justify-between mt-auto">
        <div>
          <span className="text-base font-bold text-primary-ink">₹{product.sale_price.toFixed(0)}</span>
          {product.market_price > product.sale_price && (
            <span className="text-xs text-muted line-through ml-1.5">₹{product.market_price.toFixed(0)}</span>
          )}
        </div>
        <button
          onClick={() => onAddToCart?.(product)}
          disabled={!product.in_stock}
          className="w-9 h-9 rounded-full bg-primary-light text-primary-ink hover:bg-primary hover:text-white transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Add ${product.name} to cart`}
        >
          <ShoppingCart size={15} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
