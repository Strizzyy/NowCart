import { useEffect, useRef, useState } from 'react';
import { Zap, Clock, Truck, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';
import type { AppContext } from '../App';
import { postSos, type CartResponse } from '../api/client';
import { Button, Card, Chip, Spinner, ErrorState } from '../ui';

interface Props {
  ctx: AppContext;
}

const QUICK_SITUATIONS = [
  { label: '🎉 Guests in 30 min', value: 'unexpected guests arriving in 30 minutes' },
  { label: '🤒 Fever at home', value: 'child has a fever, need basics' },
  { label: '👶 Baby supplies', value: 'baby supplies running out urgently' },
  { label: '🌧️ Stuck in', value: 'heavy rain, need essentials for 2 days' },
  { label: '🎊 Party tonight', value: 'hosting a party tonight for 8 people' },
  { label: '📦 Weekly restock', value: 'weekly essentials restock for family of 4' },
];

type Step = 'pick' | 'kit' | 'confirm' | 'placed';

function useCountdown(minutes: number | null, active: boolean) {
  const [secondsLeft, setSecondsLeft] = useState<number>((minutes ?? 0) * 60);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    setSecondsLeft((minutes ?? 0) * 60);
  }, [minutes]);

  useEffect(() => {
    if (!active || minutes == null) return;
    ref.current = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (ref.current) window.clearInterval(ref.current);
    };
  }, [active, minutes]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export default function SosPage({ ctx }: Props) {
  const [situation, setSituation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [cart, setCart] = useState<CartResponse | null>(null);

  const eta = cart?.eta_minutes ?? 30;
  const countdown = useCountdown(eta, step === 'kit' || step === 'confirm' || step === 'placed');

  const triggerSos = async (sit: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await postSos(sit);
      setCart(result);
      ctx.setCart(result);
      setStep('kit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the emergency kit.');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!situation.trim() || loading) return;
    triggerSos(situation.trim());
  };

  // ---------------- Kit / confirm / placed (post-build) ----------------
  if (cart && step !== 'pick') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Urgency banner + ETA countdown */}
        <div className="bg-accent text-white rounded-2xl p-5 mb-5 flex items-center justify-between shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center nc-pulse">
              <Zap size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading font-bold text-lg leading-tight">Emergency mode</p>
              <p className="text-xs text-white/85">Fastest-delivery items only</p>
            </div>
          </div>
          <div className="text-right" aria-live="polite">
            <p className="text-xs text-white/85 flex items-center gap-1 justify-end">
              <Clock size={12} aria-hidden="true" /> Arrives in
            </p>
            <p className="text-2xl font-bold tabular-nums">{countdown}</p>
          </div>
        </div>

        {step === 'placed' ? (
          <Card padding="lg" className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} aria-hidden="true" />
            </div>
            <h2 className="font-heading font-bold text-xl text-dark mb-1">Emergency order placed</h2>
            <p className="text-muted text-sm">
              {cart.items.length} items on the way · arriving in {countdown}.
            </p>
            <Button variant="outline" size="md" className="mt-5" onClick={() => { setStep('pick'); setCart(null); }}>
              Done
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold text-lg text-dark">
                Your emergency kit ({cart.items.length})
              </h2>
              <Chip tone="success" size="sm">{Math.round(cart.confidence * 100)}% confident</Chip>
            </div>

            <div className="space-y-2 mb-4">
              {cart.items.map((item) => (
                <Card key={item.product_id} padding="sm" className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dark truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Chip tone="success" size="xs" icon={<Truck size={10} />}>Fastest delivery</Chip>
                      <span className="text-xs text-muted">{item.quantity} {item.unit}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary-ink shrink-0">₹{item.line_total.toFixed(0)}</span>
                </Card>
              ))}
            </div>

            <Card padding="md" className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted">Total</p>
                <p className="text-xl font-bold text-dark">₹{cart.total.toFixed(0)}</p>
              </div>
              {/* 2-tap checkout: kit → confirm → placed */}
              {step === 'kit' ? (
                <Button variant="accent" size="lg" onClick={() => setStep('confirm')} leftIcon={<Zap size={18} />}>
                  Place emergency order
                </Button>
              ) : (
                <Button variant="accent" size="lg" onClick={() => setStep('placed')} leftIcon={<ShieldCheck size={18} />}>
                  Confirm &amp; pay
                </Button>
              )}
            </Card>

            <button
              onClick={() => (step === 'confirm' ? setStep('kit') : setStep('pick'))}
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-dark transition"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {step === 'confirm' ? 'Back to kit' : 'Pick another situation'}
            </button>
          </>
        )}
      </div>
    );
  }

  // ---------------- Situation picker ----------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap size={32} className="text-accent" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-dark mb-2">SOS Emergency Mode</h1>
        <p className="text-muted">
          Describe your situation — we instantly assemble an emergency kit of the
          fastest-delivery essentials, ready in two taps.
        </p>
      </div>

      {error && (
        <div className="mb-5">
          <ErrorState title="Couldn't build the kit" description={error} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="mb-6">
        <p className="text-sm font-medium text-dark mb-3">Quick pick a situation:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {QUICK_SITUATIONS.map((qs) => (
            <button
              key={qs.value}
              onClick={() => triggerSos(qs.value)}
              disabled={loading}
              className="text-left p-3 bg-light-bg border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition text-sm disabled:opacity-50"
            >
              {qs.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="sos-situation" className="text-sm font-medium text-dark mb-2 block">
            Or describe your emergency:
          </label>
          <textarea
            id="sos-situation"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. 'My in-laws arrive in 20 minutes and I have nothing at home!'"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent resize-none h-24"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!situation.trim()}
          leftIcon={!loading ? <Zap size={18} /> : undefined}
        >
          {loading ? 'Building emergency kit…' : 'Get emergency kit now'}
        </Button>
      </form>

      {loading && (
        <div className="mt-6 flex justify-center">
          <Spinner size={24} />
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <Card padding="md" className="flex items-start gap-3">
          <Clock size={20} className="text-accent-dark shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-dark">Express delivery</p>
            <p className="text-xs text-muted">SOS orders are filtered to the fastest in-stock items.</p>
          </div>
        </Card>
        <Card padding="md" className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-primary-ink shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-dark">Smart substitutions</p>
            <p className="text-xs text-muted">Anything out of stock is swapped for the best alternative.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
