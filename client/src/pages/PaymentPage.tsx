import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CreditCard, Smartphone, Wallet, Truck, ShieldCheck,
  Lock, ChevronRight, ArrowLeft, CheckCircle2, Loader2,
} from 'lucide-react';
import type { AppContext } from '../App';
import { placeOrder } from '../api/client';
import { FadeIn } from '../ui';

interface Props { ctx: AppContext }

type PayMethod = 'upi' | 'card' | 'wallet' | 'cod';

/** Map logged-in user to backend user_id (mirrors CartDrawer) */
function resolveUserId(user: { email?: string; userId?: string } | null | undefined): string {
  if (!user) return 'user-005';
  if (user.userId) return user.userId;
  const email = user.email ?? '';
  const map: Record<string, string> = {
    'rahul@gmail.com': 'rahul',
    'priya@example.com': 'user-001',
    'rahul@example.com': 'user-002',
    'anita@example.com': 'user-003',
    'vikram@example.com': 'user-004',
    'demo@example.com': 'user-005',
    'demo@nowcart.app': 'user-005',
    'admin@nowcart.app': 'user-001',
    'guest@nowcart.app': 'user-005',
  };
  return map[email.toLowerCase()] || email.split('@')[0];
}

/* ── UPI logos as simple colour chips ── */
const UPI_APPS = [
  { id: 'gpay',    label: 'Google Pay',  bg: 'bg-blue-50',   border: 'border-blue-200',   emoji: '🅖' },
  { id: 'phonepe', label: 'PhonePe',     bg: 'bg-purple-50', border: 'border-purple-200', emoji: '🅟' },
  { id: 'paytm',   label: 'Paytm',       bg: 'bg-sky-50',    border: 'border-sky-200',    emoji: '🅟' },
  { id: 'bhim',    label: 'BHIM',        bg: 'bg-orange-50', border: 'border-orange-200', emoji: '🏛' },
];

const WALLETS = [
  { id: 'paytm',   label: 'Paytm',    emoji: '💙', bal: '₹240' },
  { id: 'amazon',  label: 'Amazon',   emoji: '🟡', bal: '₹0' },
  { id: 'mobikwik',label: 'MobiKwik', emoji: '💜', bal: '₹135' },
];

export default function PaymentPage({ ctx }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab  = (location.state as { activeTab?: string } | null)?.activeTab ?? 'recommended';

  const { cart } = ctx;
  const total = cart
    ? (activeTab === 'economical' ? cart.economical_total : cart.total)
    : 0;
  const itemCount = cart?.items.length ?? 0;

  /* ── state ── */
  const [method, setMethod]           = useState<PayMethod>('upi');
  const [upiApp, setUpiApp]           = useState('gpay');
  const [upiId, setUpiId]             = useState('');
  const [upiMode, setUpiMode]         = useState<'app' | 'id'>('app');
  const [wallet, setWallet]           = useState('paytm');
  const [cardNum, setCardNum]         = useState('');
  const [cardName, setCardName]       = useState('');
  const [cardExp, setCardExp]         = useState('');
  const [cardCvv, setCardCvv]         = useState('');
  const [saveCard, setSaveCard]       = useState(false);
  const [step, setStep]               = useState<'form' | 'processing' | 'done'>('form');
  const [processingMsg, setProcessingMsg] = useState('');

  /* ── helpers ── */
  const formatCard = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const canPay = () => {
    if (method === 'upi') {
      if (upiMode === 'id') return upiId.includes('@') && upiId.length > 4;
      return true;
    }
    if (method === 'card')
      return cardNum.replace(/\s/g, '').length === 16 && cardName.trim() && cardExp.length === 5 && cardCvv.length >= 3;
    return true; // wallet / cod always ready
  };

  const handlePay = async () => {
    if (!cart) return;
    setStep('processing');

    const msgs = [
      'Contacting payment gateway…',
      'Verifying details…',
      'Authorising payment…',
      'Confirming with bank…',
    ];
    let i = 0;
    setProcessingMsg(msgs[0]);
    const ticker = setInterval(() => {
      i++;
      if (i < msgs.length) setProcessingMsg(msgs[i]);
      else clearInterval(ticker);
    }, 800);

    try {
      const userId = resolveUserId(ctx.user);
      await placeOrder(cart.session_id, userId, method);
    } catch { /* demo — proceed regardless */ }

    clearInterval(ticker);
    setProcessingMsg('Payment successful!');
    setStep('done');

    setTimeout(() => {
      ctx.setCartOpen(false);
      navigate('/order-success', { state: { paymentMethod: method, activeTab } });
    }, 1200);
  };

  /* ── processing overlay ── */
  if (step === 'processing' || step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg px-4">
        <FadeIn>
          <div className="bg-surface rounded-3xl shadow-[var(--shadow-pop)] p-10 text-center max-w-sm w-full">
            {step === 'processing' ? (
              <>
                <Loader2 size={52} className="text-primary animate-spin mx-auto mb-5" />
                <h2 className="font-heading font-bold text-xl text-dark mb-2">Processing Payment</h2>
                <p className="text-sm text-muted">{processingMsg}</p>
                <div className="mt-6 h-1.5 bg-light-bg rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '70%' }} />
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={56} className="text-primary mx-auto mb-5" />
                <h2 className="font-heading font-bold text-2xl text-dark mb-2">Payment Successful!</h2>
                <p className="text-sm text-muted">Redirecting to your order…</p>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg">
      {/* ── Top bar ── */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-light-bg transition"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-dark" />
        </button>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-dark text-lg leading-tight">Checkout</h1>
          <p className="text-xs text-muted">Secure payment powered by NowCart</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-primary-ink font-semibold">
          <Lock size={13} aria-hidden="true" />
          SSL Secured
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">

        {/* ═══════════════════════════ LEFT: Payment form ═══════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Method tabs */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
              {([ 
                { id: 'upi',    label: 'UPI',     icon: <Smartphone size={18} /> },
                { id: 'card',   label: 'Card',    icon: <CreditCard size={18} /> },
                { id: 'wallet', label: 'Wallet',  icon: <Wallet size={18} /> },
                { id: 'cod',    label: 'COD',     icon: <Truck size={18} /> },
              ] as { id: PayMethod; label: string; icon: React.ReactNode }[]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={[
                    'flex flex-col items-center gap-1 py-3.5 text-xs font-semibold transition',
                    method === m.id
                      ? 'bg-primary-light text-primary-ink border-b-2 border-primary'
                      : 'text-muted hover:bg-light-bg',
                  ].join(' ')}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* ── UPI ── */}
              {method === 'upi' && (
                <div className="space-y-4">
                  <div className="flex rounded-xl bg-light-bg border border-border p-1 gap-1 w-fit">
                    {(['app','id'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setUpiMode(mode)}
                        className={[
                          'px-4 py-1.5 rounded-lg text-xs font-semibold transition',
                          upiMode === mode ? 'bg-surface shadow text-dark' : 'text-muted',
                        ].join(' ')}
                      >
                        {mode === 'app' ? 'Pay via App' : 'Enter UPI ID'}
                      </button>
                    ))}
                  </div>

                  {upiMode === 'app' ? (
                    <div>
                      <p className="text-xs font-semibold text-dark mb-3">Choose UPI app</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {UPI_APPS.map((app) => (
                          <button
                            key={app.id}
                            onClick={() => setUpiApp(app.id)}
                            className={[
                              'flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition',
                              upiApp === app.id
                                ? `${app.border} ${app.bg} font-semibold`
                                : 'border-border hover:border-primary/30',
                            ].join(' ')}
                          >
                            <span className="text-2xl">{app.emoji}</span>
                            <span className="text-xs text-dark">{app.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted mt-3">
                        You will be redirected to {UPI_APPS.find(a => a.id === upiApp)?.label} to complete payment.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label htmlFor="upi-id" className="text-xs font-semibold text-dark block">UPI ID</label>
                      <input
                        id="upi-id"
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                        className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
                      />
                      {upiId && !upiId.includes('@') && (
                        <p className="text-xs text-accent-dark">Enter a valid UPI ID (e.g. name@okhdfcbank)</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Card ── */}
              {method === 'card' && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-dark flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={13} className="text-primary-ink" />
                    Your card details are encrypted and never stored
                  </p>

                  {/* Card number */}
                  <div>
                    <label htmlFor="card-num" className="text-xs font-semibold text-dark block mb-1.5">Card Number</label>
                    <div className="relative">
                      <input
                        id="card-num"
                        type="text"
                        inputMode="numeric"
                        value={cardNum}
                        onChange={(e) => setCardNum(formatCard(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="w-full border border-border rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:border-primary min-h-[44px] font-mono tracking-widest"
                      />
                      <CreditCard size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label htmlFor="card-name" className="text-xs font-semibold text-dark block mb-1.5">Name on Card</label>
                    <input
                      id="card-name"
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      placeholder="RAHUL SHARMA"
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px] uppercase tracking-wide"
                    />
                  </div>

                  {/* Expiry + CVV */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="card-exp" className="text-xs font-semibold text-dark block mb-1.5">Expiry (MM/YY)</label>
                      <input
                        id="card-exp"
                        type="text"
                        inputMode="numeric"
                        value={cardExp}
                        onChange={(e) => setCardExp(formatExp(e.target.value))}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-cvv" className="text-xs font-semibold text-dark block mb-1.5">CVV</label>
                      <input
                        id="card-cvv"
                        type="password"
                        inputMode="numeric"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="•••"
                        maxLength={4}
                        className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* Save card */}
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-xs text-muted group-hover:text-dark transition">Save card for faster checkout next time</span>
                  </label>
                </div>
              )}

              {/* ── Wallet ── */}
              {method === 'wallet' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-dark mb-3">Choose Wallet</p>
                  {WALLETS.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setWallet(w.id)}
                      className={[
                        'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition text-left',
                        wallet === w.id
                          ? 'border-primary bg-primary-light'
                          : 'border-border hover:border-primary/40',
                      ].join(' ')}
                    >
                      <span className="text-2xl">{w.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-dark">{w.label}</p>
                        <p className="text-xs text-muted">Balance: {w.bal}</p>
                      </div>
                      {wallet === w.id && <CheckCircle2 size={18} className="text-primary-ink shrink-0" />}
                    </button>
                  ))}
                  {wallet === 'paytm' && total > 240 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                      ⚠ Insufficient Paytm balance (₹240). You'll need to top up or choose another method.
                    </div>
                  )}
                </div>
              )}

              {/* ── COD ── */}
              {method === 'cod' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-light-bg rounded-xl p-4">
                    <Truck size={22} className="text-primary-ink mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-dark mb-1">Pay when your order arrives</p>
                      <p className="text-xs text-muted">Keep exact change ready. Our delivery partner accepts cash only.</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs text-muted pl-1">
                    {[
                      'No online transaction required',
                      'Pay in cash at the time of delivery',
                      'Extra ₹20 COD handling fee applies',
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { icon: '🔒', text: '256-bit SSL' },
              { icon: '🏦', text: 'RBI Compliant' },
              { icon: '🛡', text: 'PCI-DSS Secure' },
              { icon: '↩️', text: 'Easy Refunds' },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-1.5 text-xs text-muted bg-surface border border-border rounded-full px-3 py-1.5">
                <span>{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════ RIGHT: Order summary ═════════════════════════ */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h2 className="font-heading font-bold text-dark mb-4 flex items-center gap-2">
              Order Summary
              <span className="text-xs font-normal text-muted ml-auto">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            </h2>

            {/* Items list */}
            <div className="space-y-3 mb-4 max-h-52 overflow-y-auto pr-1">
              {cart?.items.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-light-bg rounded-lg border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '📦'; }}
                      />
                    ) : <span className="text-lg">📦</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dark truncate">{item.name}</p>
                    <p className="text-[11px] text-muted">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-semibold text-dark shrink-0">₹{item.line_total.toFixed(0)}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm text-muted">
                <span>Subtotal</span>
                <span>₹{total.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted">
                <span>Delivery fee</span>
                <span className="text-primary-ink font-medium">FREE</span>
              </div>
              {method === 'cod' && (
                <div className="flex justify-between text-sm text-muted">
                  <span>COD fee</span>
                  <span>₹20</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-dark border-t border-border pt-2 mt-2">
                <span>Total</span>
                <span className="text-primary-ink">₹{(method === 'cod' ? total + 20 : total).toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={!canPay()}
            className="w-full min-h-[52px] bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-muted disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <Lock size={16} aria-hidden="true" />
            Pay ₹{(method === 'cod' ? total + 20 : total).toFixed(0)}
            <ChevronRight size={18} aria-hidden="true" />
          </button>

          <p className="text-center text-xs text-muted">
            By paying, you agree to our{' '}
            <a href="/terms" className="text-primary-ink underline">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  );
}
