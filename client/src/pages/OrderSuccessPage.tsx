import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, MapPin, Clock, Package, Sparkles, PartyPopper, Truck, CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { AppContext } from '../App';
import { Button, FadeIn } from '../ui';

interface Props {
  ctx: AppContext;
}

type PayMethod = 'upi' | 'card' | 'wallet' | 'cod';

const PAY_LABEL: Record<PayMethod, { label: string; icon: React.ReactNode }> = {
  upi:    { label: 'UPI',                 icon: <Smartphone size={14} /> },
  card:   { label: 'Credit / Debit Card', icon: <CreditCard size={14} /> },
  wallet: { label: 'Wallet',              icon: <Wallet size={14} /> },
  cod:    { label: 'Cash on Delivery',    icon: <Truck size={14} /> },
};

const VALID_METHODS = new Set<PayMethod>(['upi', 'card', 'wallet', 'cod']);

function safeMethod(raw: unknown): PayMethod {
  if (typeof raw === 'string' && VALID_METHODS.has(raw as PayMethod)) return raw as PayMethod;
  return 'upi';
}

/** Random delivery time between 10-25 minutes */
function getDeliveryTime() {
  return Math.floor(Math.random() * 16) + 10;
}

export default function OrderSuccessPage({ ctx }: Props) {
  const location = useLocation();
  const navState = location.state as { paymentMethod?: unknown; activeTab?: string } | null;
  const payMethod: PayMethod = safeMethod(navState?.paymentMethod);
  const activeTab = navState?.activeTab ?? 'recommended';

  const [showConfetti, setShowConfetti] = useState(true);
  const [progress, setProgress] = useState(0);
  const [deliveryMin] = useState(getDeliveryTime);
  const [orderNumber] = useState(() => `NC${Date.now().toString(36).toUpperCase()}`);
  const [currentStep, setCurrentStep] = useState(0);

  const itemCount = ctx.cart?.items.length ?? 0;
  const total = ctx.cart
    ? (activeTab === 'economical' ? ctx.cart.economical_total : ctx.cart.total)
    : 0;

  // Animate progress bar
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + 2;
      });
    }, 30);
    return () => clearInterval(timer);
  }, []);

  // Animate step progression
  useEffect(() => {
    const steps = [0, 1, 2, 3];
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i < steps.length) {
        setCurrentStep(steps[i]);
      } else {
        clearInterval(timer);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  // Hide confetti after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const steps = [
    { icon: <Check size={18} />, label: 'Order Confirmed', done: currentStep >= 0 },
    { icon: <Package size={18} />, label: 'Being Packed', done: currentStep >= 1 },
    { icon: <Truck size={18} />, label: 'Out for Delivery', done: currentStep >= 2 },
    { icon: <MapPin size={18} />, label: 'Arriving Soon', done: currentStep >= 3 },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
                opacity: 0.6,
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                backgroundColor: ['#3bb77e', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#34d399'][i % 6],
              }}
            />
          ))}
        </div>
      )}

      <FadeIn>
        <div className="max-w-lg w-full text-center">
          {/* Success Icon with pulse animation */}
          <div className="relative mb-6 inline-block">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto shadow-lg nc-pop-in">
              <Check size={48} className="text-white" strokeWidth={3} />
            </div>
            {/* Ripple rings */}
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-4 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute -inset-3 w-30 h-30 mx-auto rounded-full border-2 border-primary/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          </div>

          {/* Main heading */}
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-2">
            Order Placed! <PartyPopper size={28} className="inline text-secondary" />
          </h1>
          <p className="text-muted text-lg mb-1">
            Your groceries are on the way
          </p>
          <p className="text-sm text-muted mb-6">
            Order #{orderNumber}
          </p>

          {/* Delivery ETA Card */}
          <div className="bg-surface rounded-2xl border border-border shadow-[var(--shadow-card)] p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock size={20} className="text-primary-ink" />
              <span className="text-2xl font-bold text-primary-ink">{deliveryMin} minutes</span>
            </div>
            <p className="text-sm text-muted mb-4">Estimated delivery time</p>

            {/* Animated progress bar */}
            <div className="w-full h-2 bg-light-bg rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step tracker */}
            <div className="flex items-center justify-between relative">
              {/* Connection line */}
              <div className="absolute top-5 left-[12%] right-[12%] h-0.5 bg-border z-0" />
              <div
                className="absolute top-5 left-[12%] h-0.5 bg-primary z-0 transition-all duration-700"
                style={{ width: `${Math.min(currentStep * 33.33, 100) * 0.76}%` }}
              />

              {steps.map((step, i) => (
                <div key={i} className="flex flex-col items-center z-10 relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      step.done
                        ? 'bg-primary text-white scale-110 shadow-md'
                        : 'bg-light-bg text-muted border border-border'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-2 font-medium ${step.done ? 'text-primary-ink' : 'text-muted'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary mini */}
          {itemCount > 0 && (
            <div className="bg-primary-light/50 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-dark flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary-ink" /> Order Summary
                </span>
                <span className="text-sm font-bold text-primary-ink">₹{total.toFixed(0)}</span>
              </div>
              <p className="text-xs text-muted mb-2">
                {itemCount} item{itemCount !== 1 ? 's' : ''} · Delivery in {deliveryMin} min
              </p>
              {/* Payment method pill */}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-surface border border-border rounded-full px-3 py-1 text-dark">
                {PAY_LABEL[payMethod].icon}
                {PAY_LABEL[payMethod].label}
                <span className="text-primary-ink ml-0.5">· Paid ✓</span>
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/">
              <Button variant="primary" size="lg">
                Continue Shopping
              </Button>
            </Link>
            <Link to="/shop">
              <Button variant="outline" size="lg">
                Browse Products
              </Button>
            </Link>
          </div>

          {/* Fun message */}
          <p className="text-xs text-muted mt-6 italic">
            "Order saved! Subscribe will learn from this purchase to predict your next restock."
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
