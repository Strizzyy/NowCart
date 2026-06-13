import { Link } from 'react-router-dom';
import { ShoppingCart, Search, Zap } from 'lucide-react';
import { useState } from 'react';
import type { AppContext } from '../App';
import { searchCatalog, postOutcome } from '../api/client';
import { Button } from '../ui';

interface Props {
  ctx: AppContext;
}

export default function Header({ ctx }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const itemCount = ctx.cart?.items.length ?? 0;
  const cartTotal = ctx.cart?.total ?? 0;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const cart = await postOutcome(searchQuery.trim());
      ctx.setCart(cart);
      ctx.setCartOpen(true);
    } catch {
      await searchCatalog(searchQuery.trim());
    } finally {
      setSearching(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      {/* Top bar */}
      <div className="bg-primary-light text-sm text-center py-1.5 text-primary-ink font-medium">
        Quick commerce solved delivery. We solve the deciding.
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg font-heading">N</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-dark font-heading leading-tight">NowCart</h1>
            <p className="text-xs text-muted -mt-0.5">Four ways in, one cart out</p>
          </div>
        </Link>

        {/* Search bar — AI-powered shortcut */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
          <label htmlFor="header-search" className="sr-only">Describe what you need</label>
          <div className="flex items-center border-2 border-primary rounded-xl overflow-hidden bg-surface focus-within:border-primary-dark transition-colors">
            <input
              id="header-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Try "Biryani for 4" or "healthy breakfast"...'
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent text-dark"
              disabled={searching}
            />
            <button
              type="submit"
              disabled={searching}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 transition-colors disabled:opacity-60"
              aria-label="Build a cart from your request"
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* Right actions */}
        <nav className="flex items-center gap-3" aria-label="Primary actions">
          <Link to="/sos">
            <Button variant="accent" size="sm" leftIcon={<Zap size={16} aria-hidden="true" />}>
              <span className="hidden sm:inline">SOS</span>
            </Button>
          </Link>

          <button
            onClick={() => ctx.setCartOpen(true)}
            className="relative flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition"
            aria-label={`Open cart, ${itemCount} items, total ₹${cartTotal.toFixed(0)}`}
          >
            <ShoppingCart size={18} aria-hidden="true" />
            <span className="hidden sm:inline text-sm font-medium">₹{cartTotal.toFixed(0)}</span>
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {itemCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Navigation */}
      <nav className="border-t border-border bg-surface" aria-label="Sections">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 py-2 text-sm font-medium overflow-x-auto">
          <Link to="/" className="text-dark hover:text-primary-ink transition whitespace-nowrap">Home</Link>
          <Link to="/shop" className="text-dark hover:text-primary-ink transition whitespace-nowrap">Shop</Link>
          <Link to="/shop?category=Fruits%20%26%20Vegetables" className="text-muted hover:text-primary-ink transition whitespace-nowrap">Fruits & Veggies</Link>
          <Link to="/shop?category=Staples" className="text-muted hover:text-primary-ink transition whitespace-nowrap">Staples</Link>
          <Link to="/shop?category=Snacks%20%26%20Beverages" className="text-muted hover:text-primary-ink transition whitespace-nowrap">Snacks & Beverages</Link>
          <Link to="/shop?category=Dairy" className="text-muted hover:text-primary-ink transition whitespace-nowrap">Dairy</Link>
          <Link to="/sos" className="text-accent-dark hover:text-accent transition whitespace-nowrap font-semibold">SOS Mode</Link>
        </div>
      </nav>
    </header>
  );
}
