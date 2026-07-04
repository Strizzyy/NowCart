import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppContext } from '../App';
import { searchCatalog, postCartOp } from '../api/client';
import type { Product } from '../api/client';
import ProductCard from '../components/ProductCard';

const ITEMS_PER_PAGE = 12; // 3 rows × 4 columns on large screens

interface Props {
  ctx: AppContext;
}

const CATEGORIES = [
  'All',
  'fruits vegetables',
  'foodgrains oil masala',
  'snacks branded foods',
  'beverages',
  'bakery cakes dairy',
  'beauty hygiene',
  'cleaning household',
  'kitchen garden pets',
  'eggs meat fish',
  'baby care',
  'gourmet world food',
];

const CATEGORY_LABELS: Record<string, string> = {
  'All': 'All',
  'fruits vegetables': 'Fruits & Vegetables',
  'foodgrains oil masala': 'Foodgrains, Oil & Masala',
  'snacks branded foods': 'Snacks & Branded Foods',
  'beverages': 'Beverages',
  'bakery cakes dairy': 'Bakery, Cakes & Dairy',
  'beauty hygiene': 'Beauty & Hygiene',
  'cleaning household': 'Cleaning & Household',
  'kitchen garden pets': 'Kitchen, Garden & Pets',
  'eggs meat fish': 'Eggs, Meat & Fish',
  'baby care': 'Baby Care',
  'gourmet world food': 'Gourmet & World Food',
};

export default function ShopPage({ ctx }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return products.slice(start, start + ITEMS_PER_PAGE);
  }, [products, currentPage]);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setCategory(cat);
  }, [searchParams]);

  // Reset to page 1 when category or query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [category, query]);

  // Scroll to top of product grid when page changes
  useEffect(() => {
    if (!loading) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cat = category === 'All' ? undefined : category;
        const results = await searchCatalog(query || undefined, cat, 100);
        setProducts(results);
      } catch (err) {
        console.error('Search failed:', err);
      }
      setLoading(false);
    }
    load();
  }, [query, category]);

  const handleAddToCart = async (product: Product) => {
    try {
      const sessionId = ctx.cart?.session_id || '';
      const updated = await postCartOp(sessionId, 'add', product.name, 1);
      ctx.setCart(updated);
      ctx.setCartOpen(true);
    } catch { /* ignore */ }
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
        {category !== 'All' && <> / <span className="text-primary">{CATEGORY_LABELS[category] || category}</span></>}
      </p>

      {/* Mobile category pill row — horizontally scrollable, same style as Fresh picks */}
      <div className="md:hidden -mx-4 px-4 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition min-h-[36px] whitespace-nowrap ${
                category === cat
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface border border-border text-muted hover:border-primary/40 hover:text-dark'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar — desktop only */}
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
                    {CATEGORY_LABELS[cat] || cat}
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
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted mb-4">
            {loading ? 'Loading...' : `Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, products.length)} of ${products.length} products`}
          </p>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                <div key={i} className="bg-light-bg rounded-xl h-52 sm:h-64 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl block mb-4">🔍</span>
              <h3 className="font-heading font-bold text-dark mb-2">No products found</h3>
              <p className="text-muted text-sm">Try a different search or category</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {paginatedProducts.map((p) => (
                  <ProductCard key={p.product_id} product={p} onAddToCart={handleAddToCart} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-light text-dark min-h-[44px]"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} /> <span className="hidden xs:inline">Prev</span>
                  </button>

                  <div className="flex gap-2 flex-wrap justify-center">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-11 h-11 rounded-lg text-sm font-medium transition ${
                          page === currentPage
                            ? 'bg-primary text-white'
                            : 'hover:bg-primary-light text-dark'
                        }`}
                        aria-label={`Page ${page}`}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-light text-dark min-h-[44px]"
                    aria-label="Next page"
                  >
                    <span className="hidden xs:inline">Next</span> <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
