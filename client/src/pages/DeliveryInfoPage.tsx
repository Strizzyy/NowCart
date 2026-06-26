import { Link } from 'react-router-dom';
import { Truck, Clock, MapPin, RefreshCw, PhoneCall } from 'lucide-react';

export default function DeliveryInfoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-sm text-muted mb-6">
        <Link to="/" className="hover:text-primary">Home</Link> / <span className="text-dark">Delivery Info</span>
      </p>

      <h1 className="text-3xl font-heading font-bold text-dark mb-2">Delivery Information</h1>
      <p className="text-muted mb-10">Everything you need to know about how NowCart gets your groceries to your door.</p>

      <div className="space-y-8">

        <section className="bg-white border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold text-dark">Delivery Timelines</h2>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex justify-between border-b border-border pb-2">
              <span className="font-medium text-dark">Express Delivery</span>
              <span>10–30 minutes</span>
            </li>
            <li className="flex justify-between border-b border-border pb-2">
              <span className="font-medium text-dark">Standard Delivery</span>
              <span>2–4 hours</span>
            </li>
            <li className="flex justify-between">
              <span className="font-medium text-dark">Scheduled Delivery</span>
              <span>Choose a 1-hour slot up to 3 days ahead</span>
            </li>
          </ul>
          <p className="text-xs text-muted mt-4">Delivery times may vary during peak hours, bad weather, or public holidays. Real-time ETAs are shown on your order confirmation page.</p>
        </section>

        <section className="bg-white border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <Truck size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold text-dark">Delivery Charges</h2>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex justify-between border-b border-border pb-2">
              <span className="font-medium text-dark">Orders above ₹499</span>
              <span className="text-primary font-semibold">Free delivery</span>
            </li>
            <li className="flex justify-between border-b border-border pb-2">
              <span className="font-medium text-dark">Orders ₹299–₹499</span>
              <span>₹19 delivery fee</span>
            </li>
            <li className="flex justify-between">
              <span className="font-medium text-dark">Orders below ₹299</span>
              <span>₹39 delivery fee</span>
            </li>
          </ul>
          <p className="text-xs text-muted mt-4">Surge pricing may apply during high-demand windows. The final delivery charge is always shown before you confirm checkout.</p>
        </section>

        <section className="bg-white border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <MapPin size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold text-dark">Serviceable Areas</h2>
          </div>
          <p className="text-sm text-muted mb-3">NowCart currently operates in select pin codes across Mumbai. We are actively expanding to Pune, Bengaluru, and Delhi NCR.</p>
          <p className="text-sm text-muted">Enter your pin code at checkout to check availability in your area. If we don't yet serve your location, you can join the waitlist and we'll notify you when we launch near you.</p>
        </section>

        <section className="bg-white border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <RefreshCw size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold text-dark">Missed or Late Deliveries</h2>
          </div>
          <p className="text-sm text-muted mb-3">If your order is significantly delayed beyond the promised window, you will receive an automatic NowCart credit of ₹50 applied to your next order.</p>
          <p className="text-sm text-muted">If a delivery attempt is missed because no one was available, our delivery partner will attempt re-delivery once. After that, the order may be cancelled and a full refund will be issued within 3–5 business days.</p>
        </section>

        <section className="bg-white border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <PhoneCall size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold text-dark">Contact & Support</h2>
          </div>
          <p className="text-sm text-muted mb-2">For delivery-related queries, reach us at:</p>
          <ul className="text-sm text-muted space-y-1">
            <li>📧 <span className="text-dark font-medium">hello@nowcart.in</span></li>
            <li>📞 <span className="text-dark font-medium">1800-266-2278</span> (Mon–Sat, 8 AM–10 PM)</li>
          </ul>
        </section>

      </div>
    </div>
  );
}
