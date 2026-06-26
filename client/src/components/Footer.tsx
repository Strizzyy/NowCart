import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '../ui';

export default function Footer() {
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
          <form className="flex max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="newsletter-email" className="sr-only">Your email address</label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Your email address"
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
            <p className="flex items-center gap-2"><Phone size={14} aria-hidden="true" /> 1800-NowCart</p>
            <p className="flex items-center gap-2"><Mail size={14} aria-hidden="true" /> hello@nowcart.in</p>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-bold text-dark mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/about" className="hover:text-primary-ink transition">About Us</Link></li>
            <li><Link to="/" className="hover:text-primary-ink transition">Delivery Info</Link></li>
            <li><Link to="/" className="hover:text-primary-ink transition">Privacy Policy</Link></li>
            <li><Link to="/" className="hover:text-primary-ink transition">Terms & Conditions</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-bold text-dark mb-3">Account</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/orders" className="hover:text-primary-ink transition">Order History</Link></li>
            <li><Link to="/shop" className="hover:text-primary-ink transition">Browse Products</Link></li>
            <li><Link to="/" className="hover:text-primary-ink transition">Home</Link></li>
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
