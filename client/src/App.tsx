import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import SearchResultsPage from './pages/SearchResultsPage';
import CartDrawer from './components/CartDrawer';
import LoginPage from './pages/LoginPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AboutPage from './pages/AboutPage';
import DeliveryInfoPage from './pages/DeliveryInfoPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import { ToastProvider } from './ui';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import type { CartResponse } from './api/client';

export interface UserInfo {
  name: string;
  email: string;
  role: 'admin' | 'user';
  userId?: string;
  isNewUser?: boolean;   // true right after signup — triggers location prompt
}

export interface AppContext {
  cart: CartResponse | null;
  setCart: (cart: CartResponse | null) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  user: UserInfo | null;
}

/** One-time location permission banner shown to new users after signup */
function LocationPrompt({ onDismiss }: { onDismiss: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setStatus('granted');
        setTimeout(onDismiss, 1500);
      },
      () => {
        setStatus('denied');
        setRequesting(false);
      },
      { timeout: 8000 },
    );
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-auto px-4">
      <div className="bg-dark text-white rounded-2xl shadow-[var(--shadow-pop)] p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-snug">Enable location?</p>
              <p className="text-xs text-white/70 mt-0.5">
                Helps us suggest region-aware ingredients and faster delivery.
              </p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-white/50 hover:text-white mt-0.5" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>

        {status === 'granted' && (
          <p className="text-xs text-primary font-medium">✓ Location enabled — your cart will be region-aware!</p>
        )}
        {status === 'denied' && (
          <p className="text-xs text-white/60">No problem — you set your region during signup.</p>
        )}

        {status === 'idle' && (
          <div className="flex gap-2">
            <button
              onClick={requestLocation}
              disabled={requesting}
              className="flex-1 bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-60"
            >
              {requesting ? 'Requesting…' : 'Allow location'}
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2 rounded-xl transition"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function App() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(() => {
    const stored = localStorage.getItem('nowcart_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (u: UserInfo) => {
    setUser(u);
    localStorage.setItem('nowcart_user', JSON.stringify({ ...u, isNewUser: false }));
    // Show location prompt only for brand-new signups
    if (u.isNewUser) {
      setTimeout(() => setShowLocationPrompt(true), 800);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setShowLocationPrompt(false);
    localStorage.removeItem('nowcart_user');
  };

  const ctx: AppContext = { cart, setCart, cartOpen, setCartOpen, user };

  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col">
          {!user ? (
            <Routes>
              <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          ) : (
            <>
              <Header ctx={ctx} onLogout={handleLogout} />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage ctx={ctx} />} />
                  <Route path="/shop" element={<ShopPage ctx={ctx} />} />
                  <Route path="/search" element={<SearchResultsPage ctx={ctx} />} />
                  <Route path="/product/:id" element={<ProductPage ctx={ctx} />} />
                  <Route path="/order-success" element={<OrderSuccessPage ctx={ctx} />} />
                  <Route path="/orders" element={<OrderHistoryPage ctx={ctx} />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/delivery-info" element={<DeliveryInfoPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/admin" element={
                    user?.role === 'admin'
                      ? <AdminDashboardPage ctx={ctx} />
                      : <Navigate to="/" replace />
                  } />
                  <Route path="/sos" element={<Navigate to="/" replace />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
              <CartDrawer ctx={ctx} />
              {showLocationPrompt && (
                <LocationPrompt onDismiss={() => setShowLocationPrompt(false)} />
              )}
              <PwaInstallPrompt />
            </>
          )}
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
