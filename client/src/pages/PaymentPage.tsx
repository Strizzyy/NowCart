import { useState } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CheckCircle2, Loader2, Lock, MapPin, Plus, ChevronDown } from 'lucide-react';
import type { AppContext } from '../App';
import { placeOrder } from '../api/client';
import { FadeIn } from '../ui';
import { useLocation as useDeliveryLoc } from '../context/LocationContext';

interface Props { ctx: AppContext }

type PayMethod =
  | 'rec_card' | 'rec_gpay'
  | 'nc_upi'
  | 'any_upi' | 'gpay' | 'paytm' | 'phonepe' | 'qr'
  | 'nc_later' | 'lazypay' | 'amazon_later'
  | 'hdfc_card' | 'new_card'
  | 'phonepe_wallet' | 'amazon_wallet' | 'paytm_wallet'
  | 'cod';

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

/** Map UI payment method to the 4 values the server accepts */
function toServerMethod(m: PayMethod): 'upi' | 'card' | 'cod' | 'wallet' {
  if (m === 'cod') return 'cod';
  if (m === 'hdfc_card' || m === 'new_card' || m === 'rec_card') return 'card';
  if (m === 'phonepe_wallet' || m === 'amazon_wallet' || m === 'paytm_wallet') return 'wallet';
  // everything else (upi variants, pay-later, nc_upi, qr, etc.) → upi
  return 'upi';
}

function methodLabel(m: PayMethod): string {
  const labels: Record<PayMethod, string> = {
    rec_card: 'HDFC Credit Card', rec_gpay: 'GPay UPI',
    nc_upi: 'NowCart UPI',
    any_upi: 'UPI', gpay: 'Google Pay', paytm: 'Paytm', phonepe: 'PhonePe', qr: 'QR Code',
    nc_later: 'NowCart Pay Later', lazypay: 'LazyPay', amazon_later: 'Amazon Pay Later',
    hdfc_card: 'HDFC Credit Card', new_card: 'New Card',
    phonepe_wallet: 'PhonePe Wallet', amazon_wallet: 'Amazon Pay Balance', paytm_wallet: 'Paytm Wallet',
    cod: 'Cash on Delivery',
  };
  return labels[m];
}

/* ── tiny reusable row ── */
function Row({
  left, title, subtitle, right, selected, onClick, disabled = false,
}: {
  left: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-3.5 text-left transition',
        disabled ? 'opacity-50 cursor-default' : onClick ? 'hover:bg-gray-50 active:bg-gray-100' : 'cursor-default',
        selected ? 'bg-green-50' : '',
      ].join(' ')}
    >
      <div className="shrink-0 w-10 flex items-center justify-center">{left}</div>
      <div className="flex-1 min-w-0">
        <p className={['text-sm font-semibold leading-tight', disabled ? 'text-gray-400' : 'text-gray-900'].join(' ')}>
          {title}
        </p>
        {subtitle && (
          <p className={['text-xs mt-0.5 leading-tight', disabled ? 'text-gray-300' : 'text-gray-500'].join(' ')}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="shrink-0 ml-2">{right ?? (onClick && !disabled
        ? <ChevronRight size={17} className={selected ? 'text-green-500' : 'text-gray-400'} />
        : null)}
      </div>
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white mx-3 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm border border-gray-100">
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-5 pb-2 text-sm font-bold text-gray-800">{children}</p>;
}

/* ── Icon components ── */
function VisaChip() {
  return (
    <div className="w-10 h-7 bg-blue-700 rounded-md flex items-center justify-center">
      <span className="text-white text-xs font-extrabold italic tracking-wider">VISA</span>
    </div>
  );
}

function GPayIcon() {
  return (
    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 48 48" width="28" height="28">
        <path fill="#4285F4" d="M24 22v5h7c-.6 3.2-3.3 5.5-7 5.5-4.3 0-7.8-3.5-7.8-7.8s3.5-7.8 7.8-7.8c2 0 3.7.7 5 1.9l3.7-3.7C30.4 13.5 27.4 12 24 12c-6.6 0-12 5.4-12 12s5.4 12 12 12c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.5-.2-2.3H24z"/>
      </svg>
    </div>
  );
}

function NcUpiIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-green-600 flex flex-col items-center justify-center">
      <span className="text-white font-black text-xs leading-none">NC</span>
      <span className="text-green-200 text-[8px] leading-none font-semibold mt-0.5">UPI ▶</span>
    </div>
  );
}

function UpiIcon() {
  return (
    <div className="w-10 h-10 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
      <span className="text-xs font-bold text-gray-500 tracking-tight">UPI</span>
    </div>
  );
}

function QrIcon() {
  return (
    <div className="w-10 h-10 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6b7280" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <path d="M14 14h2v2h-2zM18 14h3v3h-3zM14 18h3v3h-3zM18 20h3"/>
      </svg>
    </div>
  );
}

function PaytmIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center">
      <span className="text-white text-[10px] font-black leading-none">paytm</span>
    </div>
  );
}

function PhonePeIcon() {
  return (
    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
      <span className="text-white font-black text-sm">₱</span>
    </div>
  );
}

function AmazonIcon() {
  return (
    <div className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center">
      <span className="text-[10px] font-black text-gray-800">pay</span>
    </div>
  );
}

function PayLaterIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-purple-700 flex flex-col items-center justify-center">
      <span className="text-white text-[7px] font-black leading-none">PAY</span>
      <span className="text-white text-[7px] font-black leading-none">LATER</span>
    </div>
  );
}

function LazyIcon() {
  return (
    <div className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center">
      <span className="text-pink-500 font-black text-sm">▶</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ MAIN PAGE ══ */
export default function PaymentPage({ ctx }: Props) {
  const navigate = useNavigate();
  const routerLoc = useRouterLocation();
  const activeTab = (routerLoc.state as { activeTab?: string } | null)?.activeTab ?? 'recommended';
  const { activeAddress } = useDeliveryLoc();

  const { cart } = ctx;
  const total = cart ? (activeTab === 'economical' ? cart.economical_total : cart.total) : 0;

  const [method, setMethod] = useState<PayMethod>('rec_gpay');
  const [upiId, setUpiId] = useState('');
  const [showUpiInput, setShowUpiInput] = useState(false);
  const [showMoreWallets, setShowMoreWallets] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'done'>('form');
  const [processingMsg, setProcessingMsg] = useState('');

  const isCod = method === 'cod';
  const displayTotal = isCod ? total + 20 : total;

  const handlePay = async () => {
    if (!cart) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    setStep('processing');
    const msgs = ['Contacting gateway…', 'Verifying…', 'Authorising…', 'Confirming…'];
    let i = 0;
    setProcessingMsg(msgs[0]);
    const ticker = setInterval(() => { i++; if (i < msgs.length) setProcessingMsg(msgs[i]); else clearInterval(ticker); }, 800);
    try { await placeOrder(cart.session_id, resolveUserId(ctx.user), toServerMethod(method)); } catch { /* demo */ }
    clearInterval(ticker);
    setProcessingMsg('Payment successful!');
    setStep('done');
    setTimeout(() => {
      ctx.setCartOpen(false);
      navigate('/order-success', { state: { paymentMethod: toServerMethod(method), activeTab } });
    }, 1200);
  };

  /* ── Processing / Done overlay ── */
  if (step !== 'form') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 px-4">
        <FadeIn>
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
            {step === 'processing' ? (
              <>
                <Loader2 size={52} className="text-green-500 animate-spin mx-auto mb-5" />
                <h2 className="font-bold text-xl text-gray-900 mb-2">Processing Payment</h2>
                <p className="text-sm text-gray-500">{processingMsg}</p>
                <div className="mt-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full animate-pulse w-3/4" />
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={56} className="text-green-500 mx-auto mb-5" />
                <h2 className="font-bold text-2xl text-gray-900 mb-2">Payment Successful!</h2>
                <p className="text-sm text-gray-500">Redirecting to your order…</p>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    );
  }

  /* ── pink LINK button ── */
  const LinkBtn = () => (
    <span className="text-pink-500 text-xs font-bold flex items-center gap-0.5 whitespace-nowrap">
      LINK <ChevronRight size={13} />
    </span>
  );

  /* ── NEW badge ── */
  const NewBadge = () => (
    <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded ml-1.5">NEW</span>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-32">

      {/* ══ STICKY HEADER ══ */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        {/* nav row */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <button
            onClick={() => navigate(-1)}
            className="mt-0.5 p-1 rounded-full hover:bg-gray-100 transition shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-gray-800" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">Payment Options</h1>
            {/* fetched location */}
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={12} className="text-green-600 shrink-0" />
              {activeAddress ? (
                <p className="text-xs text-gray-500 leading-tight truncate max-w-[260px]">
                  Delivering to{' '}
                  <span className="font-semibold text-gray-700">{activeAddress.label ?? 'Home'}</span>
                  {' — '}
                  {[activeAddress.area, activeAddress.city].filter(Boolean).join(', ')}
                  {activeAddress.pincode ? ` — ${activeAddress.pincode}` : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-400">Set a delivery address</p>
              )}
            </div>
          </div>
        </div>

        {/* To Pay row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
          <p className="text-sm text-gray-700">
            To Pay:{' '}
            <span className="font-extrabold text-green-600 text-base">₹{displayTotal.toFixed(0)}</span>
            {isCod && <span className="text-xs text-gray-400 ml-1">(incl. ₹20 COD fee)</span>}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Lock size={11} />
            <span>100% Secure</span>
          </div>
        </div>
      </div>

      {/* ══ SCROLLABLE BODY ══ */}
      <div className="pt-3 space-y-1">

        {/* ── Recommended ── */}
        <SectionHeading>Recommended</SectionHeading>
        <SectionCard>
          <Row
            left={<VisaChip />}
            title="HDFC Credit Card"
            subtitle={<>**** 7396 &nbsp;|&nbsp; <span className="text-teal-500 font-semibold">CVV Less</span></>}
            selected={method === 'rec_card'}
            onClick={() => setMethod('rec_card')}
          />
          <Row
            left={<GPayIcon />}
            title="GPay UPI"
            selected={method === 'rec_gpay'}
            onClick={() => setMethod('rec_gpay')}
          />
        </SectionCard>

        {/* ── NowCart UPI ── */}
        <div className="px-3 pt-5 pb-2 flex items-center gap-2">
          <span className="text-green-600 font-extrabold text-lg italic tracking-tight">nowcart</span>
          <span className="text-sm font-bold text-gray-800">UPI ▶</span>
        </div>
        <SectionCard>
          <Row
            left={<NcUpiIcon />}
            title="Unlock NowCart UPI"
            subtitle="Pay via UPI without leaving the app"
            right={<LinkBtn />}
            selected={method === 'nc_upi'}
            onClick={() => setMethod('nc_upi')}
          />
        </SectionCard>

        {/* ── Pay by UPI ── */}
        <SectionHeading>Pay by UPI</SectionHeading>
        <SectionCard>
          {/* Any UPI app */}
          <Row
            left={<UpiIcon />}
            title="Pay by any UPI app"
            subtitle="Use any UPI app on the phone to pay"
            selected={method === 'any_upi'}
            onClick={() => { setMethod('any_upi'); setShowUpiInput(v => !v); }}
          />

          {/* UPI app grid */}
          <div className="px-4 py-3 grid grid-cols-4 gap-3 bg-white">
            {([
              { id: 'gpay' as PayMethod, label: 'GPay', icon: <GPayIcon /> },
              { id: 'paytm' as PayMethod, label: 'Paytm', icon: <PaytmIcon /> },
              { id: 'phonepe' as PayMethod, label: 'PhonePe', icon: <PhonePeIcon /> },
              { id: 'qr' as PayMethod, label: 'QR Code', icon: <QrIcon /> },
            ]).map(app => (
              <button
                key={app.id}
                onClick={() => { setMethod(app.id); setShowUpiInput(false); }}
                className={[
                  'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition',
                  method === app.id ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50',
                ].join(' ')}
              >
                {app.icon}
                <span className="text-[10px] text-gray-700 font-medium leading-tight text-center">{app.label}</span>
              </button>
            ))}
          </div>

          {/* UPI ID input */}
          {showUpiInput && method === 'any_upi' && (
            <div className="px-4 pb-4">
              <input
                type="text"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="Enter UPI ID (e.g. name@upi)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500"
              />
              {upiId && !upiId.includes('@') && (
                <p className="text-xs text-red-500 mt-1">Enter a valid UPI ID ending with @bankname</p>
              )}
            </div>
          )}

          {/* QR row */}
          <Row
            left={<QrIcon />}
            title={<span className="flex items-center">Pay via QR Code <NewBadge /></span>}
            selected={method === 'qr'}
            onClick={() => setMethod('qr')}
          />
        </SectionCard>

        {/* ── Pay Later ── */}
        <SectionHeading>Pay Later</SectionHeading>
        <SectionCard>
          <Row
            left={<PayLaterIcon />}
            title={<span className="flex items-center text-gray-400">NowCart Pay Later <NewBadge /></span>}
            subtitle="by snapmint"
            right={<span className="text-xs text-gray-400 whitespace-nowrap">Currently Ineligible</span>}
            disabled
          />
          <Row
            left={<LazyIcon />}
            title={<span className="text-gray-400">LazyPay</span>}
            right={<span className="text-xs text-gray-400 whitespace-nowrap">Currently Ineligible</span>}
            disabled
          />
          <Row
            left={<AmazonIcon />}
            title="Amazon Pay Later"
            right={<LinkBtn />}
            selected={method === 'amazon_later'}
            onClick={() => setMethod('amazon_later')}
          />
        </SectionCard>

        {/* ── Credit & Debit Cards ── */}
        <SectionHeading>Credit &amp; Debit Cards</SectionHeading>
        <SectionCard>
          <Row
            left={<VisaChip />}
            title="HDFC Credit Card"
            subtitle={<>**** 7396 &nbsp;|&nbsp; <span className="text-teal-500 font-semibold">CVV Less</span></>}
            selected={method === 'hdfc_card'}
            onClick={() => setMethod('hdfc_card')}
          />
          <button
            onClick={() => setMethod('new_card')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left"
          >
            <div className="w-10 h-10 rounded-full border-2 border-green-500 flex items-center justify-center shrink-0">
              <Plus size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-600">Add New Card</p>
              <p className="text-xs text-gray-500">Visa, Mastercard, Rupay &amp; more</p>
            </div>
          </button>
        </SectionCard>

        {/* ── Wallets ── */}
        <SectionHeading>Wallets</SectionHeading>
        <SectionCard>
          <Row
            left={<PhonePeIcon />}
            title="PhonePe Wallet"
            selected={method === 'phonepe_wallet'}
            onClick={() => setMethod('phonepe_wallet')}
          />
          <Row
            left={<AmazonIcon />}
            title="Amazon Pay Balance"
            right={<LinkBtn />}
            selected={method === 'amazon_wallet'}
            onClick={() => setMethod('amazon_wallet')}
          />

          {!showMoreWallets ? (
            <button
              onClick={() => setShowMoreWallets(true)}
              className="w-full flex items-center gap-2 px-4 py-3.5 hover:bg-gray-50 transition"
            >
              <ChevronDown size={17} className="text-green-600" />
              <span className="text-sm font-semibold text-green-600">View More Wallets</span>
            </button>
          ) : (
            <>
              <Row
                left={<PaytmIcon />}
                title="Paytm Wallet"
                subtitle="Balance: ₹240"
                selected={method === 'paytm_wallet'}
                onClick={() => setMethod('paytm_wallet')}
              />
              <Row
                left={
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <span className="text-xl">💰</span>
                  </div>
                }
                title="Cash on Delivery"
                subtitle="₹20 handling fee applies"
                selected={method === 'cod'}
                onClick={() => setMethod('cod')}
              />
            </>
          )}
        </SectionCard>

        {/* ── Trust badges ── */}
        <div className="flex flex-wrap gap-2 justify-center px-3 pt-5 pb-2">
          {[['🔒', '256-bit SSL'], ['🏦', 'RBI Compliant'], ['🛡', 'PCI-DSS'], ['↩️', 'Easy Refunds']].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1.5">
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

      </div>{/* end scrollable body */}

      {/* ══ STICKY PAY BUTTON ══ */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <p className="text-xs text-gray-500 mb-2 text-center">
          Paying via <span className="font-semibold text-gray-800">{methodLabel(method)}</span>
        </p>
        <button
          onClick={handlePay}
          disabled={!cart}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl py-3.5 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          <Lock size={15} />
          Pay ₹{displayTotal.toFixed(0)}
        </button>
      </div>

    </div>
  );
}
