import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { Button, useToast } from '../ui';

export default function Footer() {
  const [email, setEmail] = useState('');
  const { notify } = useToast();
  const navigate = useNavigate();

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
    notify('You are now subscribed to NowCart. You will receive emails until you choose to unsubscribe.', 'success');
    setEmail('');
  };

  const handleHome = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <footer className="bg-light-bg border-t border-border mt-12">
      {/* Newsletter */}
      <div className="bg-primary text-white py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-heading font-bold mb-2">
            One brain for your whole grocery run
          </h3>
          <p className="text-white/90 text-sm mb-4">
            Get tips on shopping by intent with NowCart
          </p>
          <form className="flex max-w-md mx-auto" onSubmit={handleSubscribe}>
            <label htmlFor="newsletter-email" className="sr-only">Your email address</label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-l-lg text-dark text-sm outline-none bg-white"
            />
            <Button type="submit" variant="secondary" size="md" className="rounded-l-none rounded-r-lg">
              Subscribe
            </Button>
          </form>
        </div>
      </div>

      {/* Footer links */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold font-heading">N</span>
            </div>
            <span className="font-heading font-bold text-lg text-dark">NowCart</span>
          </div>
          <p className="text-muted text-sm mb-3">
            The intent-capture layer for quick commerce. Tell us the moment, we build the cart.
          </p>
          <div className="space-y-2 text-sm text-muted">
            <p className="flex items-center gap-2"><MapPin size={14} aria-hidden="true" /> Mumbai, India</p>
            <p className="flex items-center gap-2"><Phone size={14} aria-hidden="true" /> 1800-266-2278</p>
            <p className="flex items-center gap-2"><Mail size={14} aria-hidden="true" /> hello@nowcart.in</p>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-bold text-dark mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/about" className="hover:text-primary-ink transition">About Us</Link></li>
            <li><Link to="/delivery-info" className="hover:text-primary-ink transition">Delivery Info</Link></li>
            <li><Link to="/privacy-policy" className="hover:text-primary-ink transition">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-primary-ink transition">Terms & Conditions</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-bold text-dark mb-3">Account</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/orders" className="hover:text-primary-ink transition">Order History</Link></li>
            <li><Link to="/shop" className="hover:text-primary-ink transition">Browse Products</Link></li>
            <li><a href="/" onClick={handleHome} className="hover:text-primary-ink transition cursor-pointer">Home</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-bold text-dark mb-3">Popular</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/shop?category=foodgrains%20oil%20masala" className="hover:text-primary-ink transition">Staples</Link></li>
            <li><Link to="/shop?category=snacks%20branded%20foods" className="hover:text-primary-ink transition">Snacks & Beverages</Link></li>
            <li><Link to="/shop?category=fruits%20vegetables" className="hover:text-primary-ink transition">Fruits & Veggies</Link></li>
            <li><Link to="/sos" className="hover:text-primary-ink transition">SOS Emergency Kit</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-muted">
        © 2026 NowCart. Five ways in, one brain, one confident cart out.
      </div>
    </footer>
  );
}
