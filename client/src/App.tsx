import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import SearchResultsPage from './pages/SearchResultsPage';
import CartDrawer from './components/CartDrawer';
import SosPage from './pages/SosPage';
import LoginPage from './pages/LoginPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AboutPage from './pages/AboutPage';
import { ToastProvider } from './ui';
import type { CartResponse } from './api/client';

export interface UserInfo {
  name: string;
  email: string;
  role: 'admin' | 'user';
  userId?: string;  // backend user_id from auth
}

export interface AppContext {
  cart: CartResponse | null;
  setCart: (cart: CartResponse | null) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  user: UserInfo | null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(() => {
    const stored = localStorage.getItem('nowcart_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (u: UserInfo) => {
    setUser(u);
    localStorage.setItem('nowcart_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
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
                  <Route path="/sos" element={<SosPage ctx={ctx} />} />
                  <Route path="/order-success" element={<OrderSuccessPage ctx={ctx} />} />
                  <Route path="/orders" element={<OrderHistoryPage ctx={ctx} />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/admin" element={
                    user?.role === 'admin'
                      ? <AdminDashboardPage ctx={ctx} />
                      : <Navigate to="/" replace />
                  } />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
              <CartDrawer ctx={ctx} />
            </>
          )}
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
