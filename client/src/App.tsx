import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartDrawer from './components/CartDrawer';
import SosPage from './pages/SosPage';
import { ToastProvider } from './ui';
import type { CartResponse } from './api/client';

export interface AppContext {
  cart: CartResponse | null;
  setCart: (cart: CartResponse | null) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

function App() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const ctx: AppContext = { cart, setCart, cartOpen, setCartOpen };

  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Header ctx={ctx} />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage ctx={ctx} />} />
              <Route path="/shop" element={<ShopPage ctx={ctx} />} />
              <Route path="/product/:id" element={<ProductPage ctx={ctx} />} />
              <Route path="/sos" element={<SosPage ctx={ctx} />} />
            </Routes>
          </main>
          <Footer />
          <CartDrawer ctx={ctx} />
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
