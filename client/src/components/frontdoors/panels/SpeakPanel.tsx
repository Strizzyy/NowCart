import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, ShoppingCart, ArrowRight, BadgeDollarSign } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button, Spinner, ErrorState, Chip } from '../../../ui';
import type { AppContext } from '../../../App';
import type { CartResponse, CartItem } from '../../../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE — hardcoded for demo video. Set false to restore real mic + API.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MODE = true;

// Real BigBasket image URLs pulled from the catalog CSV
const IMG = {
  oats:    'https://www.bigbasket.com/media/uploads/p/s/1201429_2-bb-combo-quaker-oats-15-kg-pouch-aashirvaad-atta-whole-wheat-5-kg-pouch.jpg',
  poha:    'https://www.bigbasket.com/media/uploads/p/s/10000431_18-bb-royal-pohaavalakkiavalchivda-thick.jpg',
  onion:   'https://www.bigbasket.com/media/uploads/p/s/10000025_27-fresho-banana-robusta.jpg',
  banana:  'https://www.bigbasket.com/media/uploads/p/s/10000025_27-fresho-banana-robusta.jpg',
  milk:    'https://www.bigbasket.com/media/uploads/p/s/40004532_8-mother-dairy-dahi-made-from-toned-milk.jpg',
  chilli:  'https://www.bigbasket.com/media/uploads/p/s/40206993_1-navya-food-art-green-chilli-sauce.jpg',
};

function item(
  id: string, name: string, brand: string,
  qty: number, unit: string, price: number, total: number,
  reason: string, conf: number, img: string,
): CartItem {
  return {
    product_id: id, name, brand, quantity: qty, unit,
    price, line_total: total, reason, confidence: conf,
    image_url: img, substituted_for: null, reasoning_trail: [],
  };
}

// ── Cart 1: initial "healthy breakfast for two people" ─────────────────────
const ITEMS_INITIAL: CartItem[] = [
  item('d-001', 'Quaker Oats',          'Quaker', 1, '500g',  99,  99,  'High-fibre breakfast grain',       0.97, IMG.oats),
  item('d-002', 'Poha (Flattened Rice)','Top',    1, '500g',  45,  45,  'Light nutritious breakfast',       0.93, IMG.poha),
  item('d-003', 'Onion',                'Fresh',  2, 'pcs',   12,  24,  'Used in poha tempering',           0.90, IMG.onion),
  item('d-004', 'Banana',               'Fresh',  4, 'pcs',    8,  32,  'Natural energy, healthy fruit',    0.95, IMG.banana),
  item('d-005', 'Low Fat Milk',         'Amul',   1, '500ml', 28,  28,  'Protein source for oats',          0.96, IMG.milk),
  item('d-006', 'Green Chilli',         'Fresh',  1, '100g',  15,  15,  'For tempering in poha',            0.88, IMG.chilli),
];

// Economical alternatives for cart 1
const ECO_ITEMS_INITIAL: CartItem[] = [
  item('e-001', 'BB Royal Oats',        'BB Royal',1,'500g',  72,  72,  'Budget oats alternative',         0.90, IMG.oats),
  item('e-002', 'Poha - Thick',         'BB Royal',1,'500g',  32,  32,  'Budget poha',                     0.88, IMG.poha),
  item('e-003', 'Onion',                'Fresh',   2,'pcs',   10,  20,  'Fresh onion',                     0.90, IMG.onion),
  item('e-004', 'Banana',               'Fresh',   4,'pcs',    7,  28,  'Fresh banana',                    0.92, IMG.banana),
  item('e-005', 'Toned Milk',           'Nandini', 1,'500ml', 22,  22,  'Budget milk alternative',         0.91, IMG.milk),
  item('e-006', 'Green Chilli',         'Fresh',   1,'100g',  12,  12,  'Fresh chilli',                    0.88, IMG.chilli),
];

const DEMO_CART_INITIAL: CartResponse = {
  session_id: 'demo-001',
  items: ITEMS_INITIAL,
  economical_items: ECO_ITEMS_INITIAL,
  substitutions: [],
  notes: ['Healthy breakfast for 2 people'],
  reasoning_trail: ['Parsed: healthy breakfast for two people'],
  total: 243,
  economical_total: 186,
  currency: 'INR', mode: 'voice', confidence: 0.95, degraded: false,
  remaining_budget: null, shortfall: null, clarification: null,
};

// ── Cart 2: after "remove onions from the cart" ────────────────────────────
const DEMO_CART_NO_ONIONS: CartResponse = {
  ...DEMO_CART_INITIAL,
  session_id: 'demo-002',
  items: ITEMS_INITIAL.filter(i => i.product_id !== 'd-003'),
  economical_items: ECO_ITEMS_INITIAL.filter(i => i.product_id !== 'e-003'),
  total: 219,
  economical_total: 166,
  notes: ['Removed onions from the cart'],
};

// ── Cart 3: after "swap poha with oats" ────────────────────────────────────
const DEMO_CART_SWAPPED: CartResponse = {
  ...DEMO_CART_NO_ONIONS,
  session_id: 'demo-003',
  items: [
    ...DEMO_CART_NO_ONIONS.items.filter(i => i.product_id !== 'd-002'),
    item('d-001b', 'Quaker Oats', 'Quaker', 2, '500g', 99, 198, 'Swapped poha → extra oats for fibre', 0.97, IMG.oats),
  ],
  economical_items: [
    ...DEMO_CART_NO_ONIONS.economical_items!.filter(i => i.product_id !== 'e-002'),
    item('e-001b', 'BB Royal Oats', 'BB Royal', 2, '500g', 72, 144, 'Budget oats replacement', 0.90, IMG.oats),
  ],
  total: 372,
  economical_total: 278,
  notes: ['Swapped Poha with Quaker Oats'],
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  ctx: AppContext;
  onClose: () => void;
}

type Phase = 'idle' | 'listening' | 'processing' | 'confirming' | 'error';

interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getWebRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-IN'; rec.continuous = false; rec.interimResults = true;
  return rec;
}

const isNative = Capacitor.isNativePlatform();
const webSpeechSupported = !!getWebRecognition();
const speechSupported = isNative || webSpeechSupported || DEMO_MODE;

export default function SpeakPanel({ ctx, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<'ok' | 'denied' | 'unsupported'>('ok');
  const [activeTab, setActiveTab] = useState<'recommended' | 'economical'>('recommended');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const demoStepRef = useRef(0);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      recRef.current = null;
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      if (isNative) {
        import('@capacitor-community/speech-recognition')
          .then(({ SpeechRecognition }) => SpeechRecognition.removeAllListeners())
          .catch(() => {});
      }
    };
  }, []);

  // Reset tab when cart changes
  useEffect(() => { setActiveTab('recommended'); }, [cart?.session_id]);

  // ── Demo: animate words one-by-one ────────────────────────────────────────
  const runDemoMic = (words: string[], onDone: () => void) => {
    setPhase('listening');
    setTranscript('');
    let built = '';
    let idx = 0;
    const next = () => {
      if (idx >= words.length) {
        demoTimerRef.current = setTimeout(onDone, 600);
        return;
      }
      built = idx === 0 ? words[idx] : built + ' ' + words[idx];
      idx++;
      setTranscript(built);
      demoTimerRef.current = setTimeout(next, 350);
    };
    demoTimerRef.current = setTimeout(next, 400);
  };

  const applyCart = (c: CartResponse) => { setCart(c); ctx.setCart(c); setPhase('confirming'); };

  // ── Real submit (only used when DEMO_MODE = false) ─────────────────────────
  const submitReal = async (text: string) => {
    if (!text.trim()) return;
    setPhase('processing'); setError(null);
    try {
      const { postVoiceIntent } = await import('../../../api/client');
      const result = await postVoiceIntent(text.trim(), cart?.session_id ?? ctx.cart?.session_id);
      applyCart(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice request failed');
      setPhase('error');
    }
  };

  const submit = (text: string) => {
    if (DEMO_MODE) {
      // Text input in demo — just show the initial cart directly
      setPhase('processing');
      demoTimerRef.current = setTimeout(() => applyCart(DEMO_CART_INITIAL), 1200);
    } else {
      void submitReal(text);
    }
  };

  // ── Native Capacitor mic ───────────────────────────────────────────────────
  const startListeningNative = async () => {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') { setMicStatus('denied'); return; }
      const { available } = await SpeechRecognition.available();
      if (!available) { setMicStatus('unsupported'); return; }
      setMicStatus('ok'); setTranscript(''); setPhase('listening');
      await SpeechRecognition.removeAllListeners();
      await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        if (data.matches?.length) setTranscript(data.matches[0]);
      });
      await SpeechRecognition.addListener('listeningState', async (state: { status: string }) => {
        if (state.status === 'stopped') {
          await SpeechRecognition.removeAllListeners();
          setTranscript(cur => { if (cur.trim()) void submitReal(cur); else setPhase('idle'); return cur; });
        }
      });
      const result = await SpeechRecognition.start({ language: 'en-IN', maxResults: 1, popup: false, partialResults: true });
      if (result?.matches?.length) {
        await SpeechRecognition.removeAllListeners();
        const text = result.matches[0];
        setTranscript(text); void submitReal(text);
      }
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('permission') || msg.includes('not-allowed')) setMicStatus('denied');
      else setMicStatus('unsupported');
      setPhase('idle');
    }
  };

  // ── Web SpeechRecognition ──────────────────────────────────────────────────
  const startListeningWeb = () => {
    if (recRef.current) {
      recRef.current.onend = null; recRef.current.onerror = null;
      recRef.current.onresult = null; recRef.current.stop(); recRef.current = null;
    }
    const rec = getWebRecognition();
    if (!rec) { setMicStatus('unsupported'); return; }
    recRef.current = rec;
    setMicStatus('ok'); setTranscript(''); setPhase('listening');
    rec.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setTranscript(text);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicStatus('denied');
      setPhase('idle');
    };
    rec.onend = () => {
      setTranscript(cur => { if (cur.trim()) void submitReal(cur); else setPhase('idle'); return cur; });
    };
    rec.start();
  };

  // ── startListening: demo or real ──────────────────────────────────────────
  const startListening = () => {
    if (DEMO_MODE) {
      const step = demoStepRef.current;
      if (step === 0) {
        runDemoMic(['healthy', 'breakfast', 'for', 'two', 'people'], () => {
          demoStepRef.current = 1;
          setPhase('processing');
          demoTimerRef.current = setTimeout(() => applyCart(DEMO_CART_INITIAL), 1200);
        });
      } else {
        runDemoMic(['remove', 'onions', 'from', 'the', 'cart'], () => {
          demoStepRef.current = 2;
          setPhase('processing');
          demoTimerRef.current = setTimeout(() => applyCart(DEMO_CART_NO_ONIONS), 1000);
        });
      }
      return;
    }
    if (isNative) { void startListeningNative(); return; }
    startListeningWeb();
  };

  const stopListening = () => {
    if (DEMO_MODE) { if (demoTimerRef.current) clearTimeout(demoTimerRef.current); setPhase('idle'); return; }
    if (isNative) {
      import('@capacitor-community/speech-recognition')
        .then(({ SpeechRecognition }) => SpeechRecognition.stop()).catch(() => {});
      return;
    }
    recRef.current?.stop();
  };

  // ── Follow-up: demo = noop, real = API ────────────────────────────────────
  const sendFollowUp = async (text: string) => {
    if (!text.trim() || !cart) return;
    if (DEMO_MODE) { setFollowUp(''); return; } // demo: follow-up handled via mic
    setPhase('processing'); setFollowUp('');
    try {
      const { postVoiceIntent } = await import('../../../api/client');
      const result = await postVoiceIntent(text.trim(), cart.session_id);
      applyCart(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Follow-up failed');
      setPhase('error');
    }
  };

  // ── Render: error ─────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <ErrorState
        title="Voice request failed"
        description={error ?? 'Please try again or type your request.'}
        onRetry={() => setPhase('idle')}
      />
    );
  }

  // ── Render: processing ────────────────────────────────────────────────────
  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner size={28} />
        <p className="text-sm font-semibold text-dark">Building your cart…</p>
        {transcript && <p className="text-xs text-muted max-w-sm">"{transcript}"</p>}
      </div>
    );
  }

  // ── Render: confirming ────────────────────────────────────────────────────
  if (phase === 'confirming' && cart) {
    const hasEco = !!(cart.economical_items && cart.economical_items.length > 0);
    const displayItems = activeTab === 'economical' && hasEco ? cart.economical_items! : cart.items;
    const displayTotal = activeTab === 'economical' && hasEco ? cart.economical_total : cart.total;

    return (
      <div className="space-y-3">
        {/* Caption */}
        {transcript && (
          <div className="flex items-start gap-2 text-sm text-muted bg-light-bg rounded-lg px-3 py-2">
            <Mic size={14} className="mt-0.5 shrink-0 text-primary-ink" />
            <span>Heard: "{transcript}"</span>
          </div>
        )}

        {/* Recommended / Economical tabs */}
        {hasEco && (
          <div className="flex rounded-xl bg-light-bg border border-border p-1 gap-1">
            <button
              onClick={() => setActiveTab('recommended')}
              className={['flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition',
                activeTab === 'recommended' ? 'bg-surface shadow-sm text-primary-ink' : 'text-muted hover:text-dark'].join(' ')}
            >
              <ShoppingCart size={12} />
              Recommended
              <span className="text-[10px] ml-0.5">₹{cart.total.toFixed(0)}</span>
            </button>
            <button
              onClick={() => setActiveTab('economical')}
              className={['flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition',
                activeTab === 'economical' ? 'bg-surface shadow-sm text-emerald-700' : 'text-muted hover:text-dark'].join(' ')}
            >
              <BadgeDollarSign size={12} />
              Economical
              <span className="text-[10px] ml-0.5">₹{cart.economical_total.toFixed(0)}</span>
            </button>
          </div>
        )}

        {/* Savings badge on economical tab */}
        {activeTab === 'economical' && hasEco && cart.total > cart.economical_total && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <BadgeDollarSign size={16} className="text-emerald-700 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-800">
                Save ₹{(cart.total - cart.economical_total).toFixed(0)} with economical picks
              </p>
              <p className="text-[11px] text-emerald-700">Same products, lower-priced alternatives.</p>
            </div>
          </div>
        )}

        {/* Item count */}
        <p className="text-sm font-semibold text-dark">
          {displayItems.length} item{displayItems.length === 1 ? '' : 's'} in your cart
        </p>

        {/* Items list with images */}
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {displayItems.map((item) => (
            <li key={item.product_id} className="flex items-center gap-3 px-3 py-2 bg-surface">
              <div className="w-10 h-10 bg-light-bg rounded-lg border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <span className="text-lg">🛒</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-dark truncate">
                  {item.name}
                  {item.substituted_for && <Chip tone="info" size="xs" className="ml-2 align-middle">sub</Chip>}
                </p>
                <p className="text-xs text-muted truncate">{item.quantity} {item.unit} · {item.brand || 'NowCart'}</p>
              </div>
              <span className="text-sm font-semibold text-primary-ink shrink-0">₹{item.line_total.toFixed(0)}</span>
            </li>
          ))}
        </ul>

        {/* Total + view cart */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs text-muted">Total</p>
            <p className="text-lg font-bold text-dark">₹{displayTotal.toFixed(0)}</p>
            {activeTab === 'economical' && hasEco && cart.total > cart.economical_total && (
              <p className="text-xs text-emerald-600 font-medium">
                You save ₹{(cart.total - cart.economical_total).toFixed(0)}
              </p>
            )}
          </div>
          <Button variant="primary" size="md"
            onClick={() => { ctx.setCartOpen(true); onClose(); }}
            leftIcon={<ShoppingCart size={16} />} rightIcon={<ArrowRight size={15} />}>
            View full cart
          </Button>
        </div>

        {/* Refine strip — demo: only "Swap poha" chip, no API calls */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {DEMO_MODE ? (
              <button
                onClick={() => applyCart(DEMO_CART_SWAPPED)}
                className="shrink-0 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 active:scale-95 transition"
              >
                Swap poha → oats
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
            <span className="text-indigo-400 text-xs">✦</span>
            <span className="text-xs text-indigo-400 italic">Refine: cheaper, vegan, swap…</span>
          </div>
        </div>

        {/* Follow-up mic + text bar */}
        <div className="border-t border-border pt-3">
          <label htmlFor="speak-followup" className="text-xs font-semibold text-dark">
            Follow up (e.g. "remove onions", "add more protein")
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              id="speak-followup"
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendFollowUp(followUp)}
              placeholder="e.g. remove onions"
              className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {(speechSupported && micStatus === 'ok') && (
              <Button variant="outline" size="md" onClick={startListening} aria-label="Speak a follow-up">
                <Mic size={16} />
              </Button>
            )}
            <Button variant="primary" size="md" onClick={() => sendFollowUp(followUp)} aria-label="Send follow-up">
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: idle / listening ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {!DEMO_MODE && micStatus === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-sm font-semibold text-amber-800">Microphone access needed</p>
          <p className="text-xs text-amber-700 leading-snug">
            {isNative
              ? "Allow microphone access in your phone's app settings, then try again."
              : "Tap the lock icon in Chrome's address bar → Permissions → enable Microphone."}
          </p>
          <button onClick={() => setMicStatus('ok')} className="text-xs font-semibold text-amber-800 underline">
            Try again
          </button>
        </div>
      )}

      {!DEMO_MODE && micStatus === 'unsupported' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Voice isn't supported on this device. Type your request below.
        </div>
      )}

      {/* Mic button */}
      {(DEMO_MODE || (speechSupported && micStatus !== 'unsupported')) && (
        <div className="flex flex-col items-center gap-4 py-2">
          <button
            type="button"
            onClick={phase === 'listening' ? stopListening : startListening}
            aria-label={phase === 'listening' ? 'Stop listening' : 'Start speaking'}
            className={[
              'w-24 h-24 rounded-full flex items-center justify-center transition-all',
              phase === 'listening'
                ? 'bg-accent text-white nc-pulse shadow-[var(--shadow-pop)]'
                : 'bg-primary text-white hover:bg-primary-dark shadow-[var(--shadow-card)]',
            ].join(' ')}
          >
            {phase === 'listening' ? <Square size={30} /> : <Mic size={34} />}
          </button>
          <p className="text-sm font-semibold text-dark" aria-live="polite">
            {phase === 'listening' ? 'Listening… tap to stop' : 'Tap and say a meal or moment'}
          </p>
          {transcript && (
            <p className="text-sm text-muted text-center max-w-sm" aria-live="polite">
              "{transcript}"
            </p>
          )}
          <p className="text-xs text-faint">Try: "Biryani for four" or "healthy breakfast for two"</p>
        </div>
      )}

      {/* Text input */}
      <div className="flex gap-2">
        <input
          id="speak-typed"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit(typed)}
          placeholder="e.g. healthy breakfast for two people"
          autoFocus={!DEMO_MODE && micStatus === 'unsupported'}
          className="flex-1 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
        />
        <Button variant="primary" size="md" onClick={() => submit(typed)} rightIcon={<Send size={15} />}>
          Build
        </Button>
      </div>
    </div>
  );
}
