import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, LogOut, User, Activity } from 'lucide-react';
import { useState } from 'react';
import type { AppContext } from '../App';

interface Props {
  ctx: AppContext;
  onLogout: () => void;
}

export default function Header({ ctx, onLogout }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();

  const itemCount = ctx.cart?.items.length ?? 0;
  const cartTotal = ctx.cart?.total ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
    setShowMobileSearch(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      {/* Top bar */}
      <div className="bg-primary-light text-sm text-center py-1.5 text-primary-ink font-medium">
        Quick commerce solved delivery. We solve the deciding.
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2 md:gap-4">
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

        {/* Search bar - hidden on mobile, shown as icon */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl">
          <label htmlFor="header-search" className="sr-only">Search for a product</label>
          <div className="flex items-center border-2 border-primary rounded-xl overflow-hidden bg-surface focus-within:border-primary-dark transition-colors w-full">
            <input
              id="header-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search for "milk", "paneer", "rice"...'
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent text-dark min-w-0"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 transition-colors self-stretch"
              aria-label="Search products"
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* Mobile search icon */}
        <button
          onClick={() => setShowMobileSearch(true)}
          className="md:hidden p-2 rounded-lg text-primary-ink hover:bg-primary-light transition min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Search"
        >
          <Search size={20} aria-hidden="true" />
        </button>

        {/* Right actions */}
        <nav className="flex items-center gap-2 md:gap-3 ml-auto" aria-label="Primary actions">
          <button
            onClick={() => ctx.setCartOpen(true)}
            className="relative flex items-center gap-2 bg-primary text-white px-3 md:px-4 py-2.5 rounded-lg hover:bg-primary-dark transition min-h-[44px]"
            aria-label={`Open cart, ${itemCount} items, total ₹${cartTotal.toFixed(0)}`}
          >
            <ShoppingCart size={20} aria-hidden="true" />
            <span className="hidden sm:inline text-sm font-medium">₹{cartTotal.toFixed(0)}</span>
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-xs min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold">
                {itemCount}
              </span>
            )}
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg border border-border hover:bg-light-bg transition min-h-[44px]"
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center">
                <User size={16} className="text-primary-ink" />
              </div>
              <span className="hidden md:inline text-sm font-medium text-dark max-w-[80px] truncate">
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
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 md:gap-6 py-2 text-sm font-medium overflow-x-auto scrollbar-hide">
          <Link to="/" className="text-dark hover:text-primary-ink transition whitespace-nowrap py-1">Home</Link>
          <Link to="/shop" className="text-dark hover:text-primary-ink transition whitespace-nowrap py-1">Shop</Link>
          <Link to="/shop?category=fruits%20vegetables" className="text-muted hover:text-primary-ink transition whitespace-nowrap py-1">Fruits &amp; Veggies</Link>
          <Link to="/shop?category=foodgrains%20oil%20masala" className="text-muted hover:text-primary-ink transition whitespace-nowrap py-1">Staples</Link>
          <Link to="/shop?category=snacks%20branded%20foods" className="text-muted hover:text-primary-ink transition whitespace-nowrap py-1">Snacks &amp; Beverages</Link>
          <Link to="/shop?category=bakery%20cakes%20dairy" className="text-muted hover:text-primary-ink transition whitespace-nowrap py-1">Dairy</Link>
          {ctx.user?.role === 'admin' && (
            <Link to="/admin" className="ml-auto text-purple-600 hover:text-purple-800 transition whitespace-nowrap font-semibold flex items-center gap-1 py-1">
              📊 <span className="hidden sm:inline">Admin Dashboard</span><span className="sm:hidden">Admin</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Search Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-[70] md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-dark/45 nc-fade-in" 
            onClick={() => setShowMobileSearch(false)}
            aria-hidden="true"
          />
          
          {/* Search Panel */}
          <div className="relative bg-surface h-full flex flex-col nc-pop-in">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <button
                onClick={() => setShowMobileSearch(false)}
                className="p-2 rounded-lg hover:bg-light-bg transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close search"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <h2 className="text-lg font-heading font-bold text-dark">Search Products</h2>
            </div>

            {/* Search Form */}
            <div className="p-4">
              <form onSubmit={handleSearch}>
                <div className="flex items-center border-2 border-primary rounded-xl overflow-hidden bg-surface focus-within:border-primary-dark transition-colors">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Try "milk", "paneer", "rice"...'
                    autoFocus
                    className="flex-1 px-4 py-3 text-base outline-none bg-transparent text-dark min-h-[48px]"
                  />
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-dark text-white px-5 py-3 transition-colors min-h-[48px]"
                    aria-label="Search"
                  >
                    <Search size={20} aria-hidden="true" />
                  </button>
                </div>
              </form>

              {/* Quick suggestions */}
              <div className="mt-6">
                <p className="text-sm font-semibold text-muted mb-3">Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {['Milk', 'Paneer', 'Rice', 'Onions', 'Tomatoes', 'Bread'].map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setSearchQuery(term);
                        navigate(`/search?q=${encodeURIComponent(term)}`);
                        setShowMobileSearch(false);
                      }}
                      className="px-4 py-2.5 bg-light-bg hover:bg-primary-light text-dark hover:text-primary-ink rounded-lg text-sm font-medium transition min-h-[44px]"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
