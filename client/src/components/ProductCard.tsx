import { ShoppingCart, Star, Plus, Minus } from 'lucide-react';
import type { Product } from '../api/client';
import { Link } from 'react-router-dom';
import { Card, Chip } from '../ui';

interface Props {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onRemoveFromCart?: (product: Product) => void;
  cartQty?: number; // quantity of this item currently in cart
}

export default function ProductCard({ product, onAddToCart, onRemoveFromCart, cartQty = 0 }: Props) {
  const discount = product.market_price > product.sale_price
    ? Math.round((1 - product.sale_price / product.market_price) * 100)
    : 0;

  return (
    <Card padding="sm" className="group flex flex-col hover:border-primary/40 hover:shadow-[var(--shadow-pop)] transition-all duration-200 h-full">
      {/* Badges */}
      <div className="flex gap-1 mb-1.5 min-h-[1.25rem] flex-wrap">
        {discount > 0 && <Chip tone="accent" size="xs">{discount}% OFF</Chip>}
        {!product.in_stock && <Chip tone="neutral" size="xs">Out of stock</Chip>}
      </div>

      {/* Product image */}
      <Link to={`/product/${product.product_id}`} aria-label={product.name}>
        {/* Desktop: h-32 | Mobile: h-24 */}
        <div className="w-full h-24 sm:h-32 bg-light-bg rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary-light/60 transition overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain p-1.5 sm:p-2"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-3xl sm:text-4xl" aria-hidden="true">📦</span>';
              }}
            />
          ) : (
            <span className="text-3xl sm:text-4xl" aria-hidden="true">📦</span>
          )}
        </div>
      </Link>

      {/* Category — hidden on very small screens to save space */}
      <p className="hidden xs:block text-[10px] text-muted uppercase tracking-wide mb-1 truncate">{product.category}</p>

      {/* Name */}
      <Link to={`/product/${product.product_id}`}>
        <h3 className="text-xs sm:text-sm font-semibold text-dark line-clamp-2 hover:text-primary-ink transition mb-1 min-h-[2rem] sm:min-h-[2.5rem]">
          {product.name}
        </h3>
      </Link>

      {/* Rating — compact on mobile */}
      {product.rating && (
        <div className="flex items-center gap-0.5 sm:gap-1 mb-1.5 sm:mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={10}
              className={i < Math.round(product.rating!) ? 'fill-secondary text-secondary' : 'text-border'}
              aria-hidden="true"
            />
          ))}
          <span className="text-[10px] text-muted ml-0.5">({product.rating.toFixed(1)})</span>
        </div>
      )}

      {/* Brand & unit — truncated on mobile */}
      <p className="text-[11px] sm:text-xs text-muted mb-2 sm:mb-3 truncate">{product.brand} · {product.unit}</p>

      {/* Price + Add / Qty controls */}
      <div className="flex items-center justify-between mt-auto gap-1">
        <div className="min-w-0">
          <span className="text-sm sm:text-base font-bold text-primary-ink">₹{product.sale_price.toFixed(0)}</span>
          {product.market_price > product.sale_price && (
            <span className="hidden xs:inline text-[10px] sm:text-xs text-muted line-through ml-1">₹{product.market_price.toFixed(0)}</span>
          )}
        </div>

        {cartQty > 0 ? (
          /* Quantity stepper — shown when item is already in cart */
          <div className="flex items-center gap-1 bg-primary/10 rounded-full px-1 py-0.5">
            <button
              onClick={() => onRemoveFromCart?.(product)}
              className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark active:scale-95 transition"
              aria-label={`Remove one ${product.name} from cart`}
            >
              <Minus size={12} aria-hidden="true" />
            </button>
            <span className="text-sm font-bold text-primary-ink min-w-[18px] text-center">{cartQty}</span>
            <button
              onClick={() => onAddToCart?.(product)}
              disabled={!product.in_stock}
              className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark active:scale-95 transition disabled:opacity-50"
              aria-label={`Add another ${product.name} to cart`}
            >
              <Plus size={12} aria-hidden="true" />
            </button>
          </div>
        ) : (
          /* Add to cart button — shown when item not in cart */
          <button
            onClick={() => onAddToCart?.(product)}
            disabled={!product.in_stock}
            className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full bg-primary-light text-primary-ink hover:bg-primary hover:text-white active:scale-95 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </Card>
  );
}
