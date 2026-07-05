import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Mail, MapPin, ArrowRight, Zap, Download } from 'lucide-react';
import { useToast } from '../ui';
import { usePwaInstall } from '../hooks/usePwaInstall';

export default function Footer() {
  const [email, setEmail] = useState('');
  const { notify } = useToast();
  const navigate = useNavigate();
  const { state: pwaState, triggerInstall } = usePwaInstall();
  const [showIosHint, setShowIosHint] = useState(false);

  const handleInstallClick = async () => {
    if (pwaState === 'ios' || pwaState === 'dev' || pwaState === 'manual') { setShowIosHint(true); return; }
    await triggerInstall();
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('Please enter a valid email address.', 'error');
      return;
    }
    const stored = JSON.parse(localStorage.getItem('nowcart_subscribers') || '[]') as string[];
    if (stored.includes(email.toLowerCase())) {
      notify('You have already subscribed.', 'info');
      return;
    }
    localStorage.setItem('nowcart_subscribers', JSON.stringify([...stored, email.toLowerCase()]));
    notify('Subscribed! Expect smart shopping tips in your inbox.', 'success');
    setEmail('');
  };

  const handleHome = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="mt-12" style={{ background: '#f0f5f1' }}>

      {/* ── Newsletter band ── */}
      <div style={{ background: '#e4efe6', borderBottom: '1px solid #cfe0d2' }}>
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-8">
          {/* copy */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-1.5 mb-2">
              <Zap size={14} className="text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-widest">Smart Shopping</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 leading-snug">
              One brain for your whole grocery run
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Tips on shopping by intent, straight to your inbox.
            </p>
          </div>

          {/* form + install */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <label htmlFor="newsletter-email" className="sr-only">Your email address</label>
              <input
                id="newsletter-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl text-gray-800 placeholder-gray-400 text-sm outline-none transition"
                style={{ background: '#f5faf6', border: '1.5px solid #b8d4bc' }}
                onFocus={e => (e.target.style.borderColor = '#22c55e')}
                onBlur={e => (e.target.style.borderColor = '#b8d4bc')}
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl transition active:scale-95 whitespace-nowrap"
              >
                Subscribe <ArrowRight size={14} />
              </button>
            </form>

            {/* Install App button — shown in browser only, hidden when running as installed PWA */}
            {(pwaState === 'ready' || pwaState === 'ios' || pwaState === 'dev' || pwaState === 'manual') && (
              <>
                <button
                  onClick={handleInstallClick}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-green-600 text-green-700 font-semibold text-sm hover:bg-green-600 hover:text-white transition active:scale-95"
                >
                  <Download size={15} />
                  Install NowCart App
                </button>
                {showIosHint && (
                  <p className="text-xs text-gray-500 text-center">
                    On iOS: tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">

        {/* Brand */}
        <div>
          <Link to="/" className="flex items-center gap-2.5 mb-3">
            <img
              src="/logoo.jpeg"
              alt="NowCart logo"
              className="w-10 h-10 rounded-xl"
            />
            <div>
              <h2 className="font-heading leading-tight flex items-center gap-0">
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
                <span className="text-xl font-extrabold text-gray-800" style={{ letterSpacing: '-0.02em' }}>
                  Cart
                </span>
              </h2>
              <p className="text-[11px] text-gray-400 -mt-0.5">Five ways in, one cart out</p>
            </div>
          </Link>
          <p className="text-gray-500 text-sm leading-relaxed mb-5">
            The intent-capture layer for quick commerce. Tell us the moment, we build the cart.
          </p>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex items-center gap-2"><MapPin size={13} /> Mumbai, India</li>
            <li className="flex items-center gap-2"><Phone size={13} /> 1800-266-2278</li>
            <li className="flex items-center gap-2"><Mail size={13} /> hello@nowcart.in</li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-gray-700 font-semibold text-xs uppercase tracking-widest mb-4">Company</h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'About Us', to: '/about' },
              { label: 'Delivery Info', to: '/delivery-info' },
              { label: 'Privacy Policy', to: '/privacy-policy' },
              { label: 'Terms & Conditions', to: '/terms' },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-gray-500 hover:text-green-700 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Account */}
        <div>
          <h4 className="text-gray-700 font-semibold text-xs uppercase tracking-widest mb-4">Account</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <Link to="/orders" className="text-gray-500 hover:text-green-700 transition-colors">
                Order History
              </Link>
            </li>
            <li>
              <Link to="/shop" className="text-gray-500 hover:text-green-700 transition-colors">
                Browse Products
              </Link>
            </li>
            <li>
              <a href="/" onClick={handleHome} className="text-gray-500 hover:text-green-700 transition-colors cursor-pointer">
                Home
              </a>
            </li>
          </ul>
        </div>

        {/* Popular */}
        <div>
          <h4 className="text-gray-700 font-semibold text-xs uppercase tracking-widest mb-4">Popular</h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'Staples', to: '/shop?category=foodgrains%20oil%20masala' },
              { label: 'Snacks & Beverages', to: '/shop?category=snacks%20branded%20foods' },
              { label: 'Fruits & Veggies', to: '/shop?category=fruits%20vegetables' },
              { label: 'Dairy', to: '/shop?category=bakery%20cakes%20dairy' },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-gray-500 hover:text-green-700 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ borderTop: '1px solid #cfe0d2' }} className="py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <p>© 2026 NowCart Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="italic">Five ways in · one brain · one confident cart out</p>
        </div>
      </div>

    </footer>
  );
}
