import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Zap, LogOut, User, Activity } from 'lucide-react';
import { useState } from 'react';
import type { AppContext } from '../App';
import { Button } from '../ui';

interface Props {
  ctx: AppContext;
  onLogout: () => void;
}

export default function Header({ ctx, onLogout }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const itemCount = ctx.cart?.items.length ?? 0;
  const cartTotal = ctx.cart?.total ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
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
            <p className="text-xs text-muted -mt-0.5">Five ways in, one cart out</p>
          </div>
        </Link>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
          <label htmlFor="header-search" className="sr-only">Search for a product</label>
          <div className="flex items-center border-2 border-primary rounded-xl overflow-hidden bg-surface focus-within:border-primary-dark transition-colors">
            <input
              id="header-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search for "milk", "paneer", "rice"...'
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent text-dark"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 transition-colors"
              aria-label="Search products"
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

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-light-bg transition"
              aria-label="User menu"
            >
              <div className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center">
                <User size={14} className="text-primary-ink" />
              </div>
              <span className="hidden sm:inline text-sm font-medium text-dark max-w-[80px] truncate">
                {ctx.user?.name || 'User'}
              </span>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-xl shadow-[var(--shadow-pop)] z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-dark">{ctx.user?.name}</p>
                      {ctx.user?.role === 'admin' && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">ADMIN</span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate">{ctx.user?.email}</p>
                  </div>
                  {ctx.user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full text-left px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50 transition flex items-center gap-2 border-b border-border"
                    >
                      <Activity size={14} /> Observability
                    </Link>
                  )}
                  <Link
                    to="/orders"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-light-bg transition flex items-center gap-2 border-b border-border"
                  >
                    <ShoppingCart size={14} /> Order History
                  </Link>
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    className="w-full text-left px-4 py-3 text-sm text-accent-dark hover:bg-light-bg transition flex items-center gap-2"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
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
          {ctx.user?.role === 'admin' && (
            <Link to="/admin" className="ml-auto text-purple-600 hover:text-purple-800 transition whitespace-nowrap font-semibold flex items-center gap-1">
              📊 Admin Dashboard
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
