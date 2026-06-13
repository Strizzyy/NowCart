import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import type { AppContext } from '../App';
import { searchCatalog, postCartOp, postOutcome } from '../api/client';
import type { Product } from '../api/client';
import ProductCard from '../components/ProductCard';

interface Props {
  ctx: AppContext;
}

const CATEGORIES = [
  'All',
  'Fruits & Vegetables',
  'Staples',
  'Snacks & Beverages',
  'Dairy',
  'Personal Care',
  'Household',
  'Baby Care',
  'Meat & Seafood',
];

export default function ShopPage({ ctx }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setCategory(cat);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cat = category === 'All' ? undefined : category;
        const results = await searchCatalog(query || undefined, cat, 40);
        setProducts(results);
      } catch (err) {
        console.error('Search failed:', err);
      }
      setLoading(false);
    }
    load();
  }, [query, category]);

  const handleAddToCart = async (product: Product) => {
    if (ctx.cart) {
      try {
        const updated = await postCartOp(ctx.cart.session_id, 'add', product.name, 1);
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

  const handleCategoryClick = (cat: string) => {
    setCategory(cat);
    if (cat === 'All') {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <p className="text-sm text-muted mb-4">
        Home / <span className="text-dark font-medium">Shop</span>
        {category !== 'All' && <> / <span className="text-primary">{category}</span></>}
      </p>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="bg-white border border-border rounded-xl p-4 sticky top-36">
            <h3 className="font-heading font-bold text-dark mb-3 flex items-center gap-2">
              <Filter size={16} />
              Category
            </h3>
            <ul className="space-y-1">
              {CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                      category === cat
                        ? 'bg-primary-light text-primary font-medium'
                        : 'text-muted hover:bg-light-bg hover:text-dark'
                    }`}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>

            {/* Search within */}
            <div className="mt-5">
              <h3 className="font-heading font-bold text-dark mb-2 text-sm">Search</h3>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter products..."
                className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </aside>

        {/* Products grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">
              {loading ? 'Loading...' : `${products.length} products found`}
            </p>
            {/* Mobile filter */}
            <select
              className="md:hidden border border-border rounded-md px-3 py-2 text-sm"
              value={category}
              onChange={(e) => handleCategoryClick(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-light-bg rounded-xl h-64 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl block mb-4">🔍</span>
              <h3 className="font-heading font-bold text-dark mb-2">No products found</h3>
              <p className="text-muted text-sm">Try a different search or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p.product_id} product={p} onAddToCart={handleAddToCart} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
