import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();

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
      {/* <div className="bg-primary-light text-sm text-center py-1.5 text-primary-ink font-medium">
        Quick commerce solved delivery. We solve the deciding.
      </div> */}

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2 md:gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.svg"
            alt="NowCart logo"
            className="w-10 h-10 rounded-xl"
          />
          <div className="hidden sm:block">
            <h1 className="font-heading leading-tight flex items-center gap-0">
              <span
                className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #3bb77e 0%, #157347 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Now
              </span>
              <span className="text-xl font-extrabold text-dark" style={{ letterSpacing: '-0.02em' }}>
                Cart
              </span>
            </h1>
            <p className="text-xs text-muted -mt-0.5">Five ways in, one cart out</p>
          </div>
        </Link>

        {/* Search bar - full bar on desktop, compact pill on mobile */}
        <form onSubmit={handleSearch} className="flex flex-1 max-w-2xl min-w-0">
          <label htmlFor="header-search" className="sr-only">Search for a product</label>
          <div className="flex items-center border-2 border-primary rounded-xl overflow-hidden bg-surface focus-within:border-primary-dark transition-colors w-full">
            <input
              id="header-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search "milk", "paneer"...'
              className="flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm outline-none bg-transparent text-dark min-w-0"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-primary-dark text-white px-3 md:px-5 py-2 md:py-2.5 transition-colors self-stretch flex items-center justify-center"
              aria-label="Search products"
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </form>

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

      {/* Category nav — Zepto-style icon + label chips, horizontal scroll */}
      <nav className="border-t border-border bg-surface" aria-label="Categories">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none">
          <div className="flex items-end gap-1 py-2" style={{ width: 'max-content', minWidth: '100%' }}>
            {[
              { label: 'Home',        icon: '🏠', href: '/' },
              { label: 'Shop',        icon: '🛒', href: '/shop' },
              { label: 'Fruits & Veggies', icon: '🥦', href: '/shop?category=fruits%20vegetables' },
              { label: 'Staples',     icon: '🌾', href: '/shop?category=foodgrains%20oil%20masala' },
              { label: 'Snacks',      icon: '🍪', href: '/shop?category=snacks%20branded%20foods' },
              { label: 'Dairy',       icon: '🥛', href: '/shop?category=bakery%20cakes%20dairy' },
              { label: 'Beverages',   icon: '🧃', href: '/shop?category=beverages' },
              { label: 'Beauty',      icon: '💄', href: '/shop?category=beauty%20hygiene' },
              { label: 'Household',   icon: '🧹', href: '/shop?category=cleaning%20household' },
            ].map(({ label, icon, href }) => {
              const isActive =
                href === '/'
                  ? location.pathname === '/'
                  : location.pathname + location.search === href ||
                    location.search === href.substring(href.indexOf('?'));
              return (
                <Link
                  key={label}
                  to={href}
                  className={[
                    'flex flex-col items-center gap-1 px-3 py-1.5 rounded-none relative group transition-colors shrink-0',
                    isActive ? 'text-primary-ink' : 'text-muted hover:text-dark',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Icon — no background, just the emoji */}
                  <span
                    className="w-7 h-7 flex items-center justify-center text-xl leading-none"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  {/* Label */}
                  <span className="text-[11px] font-medium whitespace-nowrap leading-tight">
                    {label}
                  </span>
                  {/* Active underline */}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2.5px] rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            {ctx.user?.role === 'admin' && (
              <Link
                to="/admin"
                className="flex flex-col items-center gap-1 px-3 py-1.5 shrink-0 text-purple-600 hover:text-purple-800 transition-colors"
              >
                <span className="w-7 h-7 flex items-center justify-center text-xl leading-none" aria-hidden="true">
                  📊
                </span>
                <span className="text-[11px] font-medium whitespace-nowrap">Admin</span>
              </Link>
            )}
          </div>
        </div>
      </nav>

    </header>
  );
}
