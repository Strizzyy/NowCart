import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, LogOut, User, Activity, Bell, Download, Share, MapPin, ChevronDown, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { AppContext } from '../App';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useLocation as useDeliveryLoc } from '../context/LocationContext';
import AddressManager from './AddressManager';

interface Props {
  ctx: AppContext;
  onLogout: () => void;
}

const SEARCH_PLACEHOLDERS = [
  'Search "paneer"…',
  'Search "milk"…',
  'Search "bread"…',
  'Search "chicken"…',
  'Search "onion"…',
  'Search "tomato"…',
  'Search "rice"…',
  'Search "eggs"…',
];

/** Cycles through placeholder texts with a clean typewriter animation — no flash on transition */
function useAnimatedPlaceholder() {
  const [display, setDisplay] = useState('');
  const stateRef = useRef({ phIndex: 0, charIndex: 0, phase: 'typing' as 'typing' | 'pause' | 'deleting' | 'gap' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const s = stateRef.current;
      const full = SEARCH_PLACEHOLDERS[s.phIndex];

      if (s.phase === 'typing') {
        if (s.charIndex < full.length) {
          s.charIndex++;
          setDisplay(full.slice(0, s.charIndex));
          timerRef.current = setTimeout(tick, 65);
        } else {
          s.phase = 'pause';
          timerRef.current = setTimeout(tick, 1600);
        }
      } else if (s.phase === 'pause') {
        s.phase = 'deleting';
        timerRef.current = setTimeout(tick, 35);
      } else if (s.phase === 'deleting') {
        if (s.charIndex > 0) {
          s.charIndex--;
          setDisplay(full.slice(0, s.charIndex));
          timerRef.current = setTimeout(tick, 35);
        } else {
          // fully deleted — move to next word, gap before typing
          s.phase = 'gap';
          s.phIndex = (s.phIndex + 1) % SEARCH_PLACEHOLDERS.length;
          timerRef.current = setTimeout(tick, 300);
        }
      } else {
        // gap phase — start typing next word
        s.charIndex = 0;
        s.phase = 'typing';
        timerRef.current = setTimeout(tick, 10);
      }
    }

    timerRef.current = setTimeout(tick, 900);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return display;
}

export default function Header({ ctx, onLogout }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [showAddressManager, setShowAddressManager] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { state: pwaState, triggerInstall } = usePwaInstall();
  const { locState, activeAddress } = useDeliveryLoc();
  const animatedPlaceholder = useAnimatedPlaceholder();

  const handleInstallClick = async () => {
    if (pwaState === 'ios') { setShowIosInstall(true); return; }
    if (pwaState === 'dev' || pwaState === 'manual') { setShowIosInstall(true); return; } // show install instructions
    await triggerInstall();
  };

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
            src="/logoo.jpeg"
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
              placeholder={animatedPlaceholder}
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

          {/* Install app button — shown in browser, hidden when running as installed PWA */}
          {(pwaState === 'ready' || pwaState === 'ios' || pwaState === 'dev' || pwaState === 'manual') && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary-light transition min-h-[44px]"
              aria-label="Install NowCart app"
            >
              <Download size={16} aria-hidden="true" />
              <span className="hidden md:inline">Install</span>
            </button>
          )}          <button
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
                  <Link
                    to="/subscriptions"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-light-bg transition flex items-center gap-2 border-b border-border"
                  >
                    <Bell size={14} /> My Subscriptions
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

      {/* ── Location bar — Zepto/Blinkit style ── */}
      <div className="border-t border-border/60 bg-surface px-4 py-1.5">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setShowAddressManager(true)}
            className="flex items-center gap-1.5 group min-h-[32px]"
            aria-label={activeAddress ? `Delivering to ${activeAddress.area}` : 'Set delivery location'}
          >
            <MapPin
              size={14}
              className={locState === 'granted' ? 'text-primary-ink shrink-0' : 'text-muted shrink-0'}
              aria-hidden="true"
            />
            {locState === 'requesting' ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Loader2 size={12} className="animate-spin" />
                Detecting location…
              </span>
            ) : locState === 'granted' && activeAddress ? (
              <span className="flex items-center gap-1 text-xs">
                <span className="font-bold text-dark truncate max-w-[140px] sm:max-w-xs">
                  {activeAddress.area}
                </span>
                {activeAddress.city && activeAddress.city !== activeAddress.area && (
                  <span className="text-muted hidden sm:inline">, {activeAddress.city}</span>
                )}
                {activeAddress.pincode && (
                  <span className="text-muted hidden md:inline"> — {activeAddress.pincode}</span>
                )}
                <ChevronDown size={12} className="text-muted ml-0.5 group-hover:text-dark transition" />
              </span>
            ) : locState === 'denied' ? (
              <span className="text-xs text-accent-dark font-medium">Location blocked — tap to add manually</span>
            ) : (
              <span className="text-xs text-muted group-hover:text-primary-ink transition font-medium">
                Set delivery location
              </span>
            )}
          </button>
        </div>
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

      {/* Address Manager */}
      {showAddressManager && <AddressManager onClose={() => setShowAddressManager(false)} />}

      {/* iOS install instructions modal */}
      {showIosInstall && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center md:hidden" onClick={() => setShowIosInstall(false)}>
          <div className="absolute inset-0 bg-dark/50" aria-hidden="true" />
          <div
            className="relative bg-surface rounded-t-2xl w-full max-w-sm mx-auto p-6 pb-8 shadow-[var(--shadow-pop)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/icon-192.png" alt="NowCart" className="w-12 h-12 rounded-xl" />
              <div>
                <p className="font-heading font-bold text-dark">Install NowCart</p>
                <p className="text-xs text-muted">
                  {pwaState === 'dev' ? 'Dev mode — in production this triggers native install' : 'Add to your Home Screen'}
                </p>
              </div>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                { icon: <Share size={16} className="text-primary-ink shrink-0" />, text: <>Tap the <strong>Share</strong> button at the bottom of Safari</> },
                { icon: <span className="text-base leading-none shrink-0">⊕</span>, text: <>Scroll down and tap <strong>Add to Home Screen</strong></> },
                { icon: <span className="text-base leading-none shrink-0">✓</span>, text: <>Tap <strong>Add</strong> in the top-right corner</> },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-dark">
                  <span className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center shrink-0 mt-0.5">
                    {step.icon}
                  </span>
                  <span className="leading-snug">{step.text}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={() => setShowIosInstall(false)}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
