import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button, Spinner, ErrorState } from '../../../ui';
import type { AppContext } from '../../../App';
import { postVoiceIntent, postCartOp, searchCatalog, type CartResponse, type CartItem } from '../../../api/client';
import PanelResult from '../PanelResult';
import ReplanBar from '../../cart/ReplanBar';

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE — set to true for the demo video, false to use real mic/API
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MODE = true;

// Hardcoded cart for "healthy breakfast for two people"
const DEMO_CART_INITIAL: CartResponse = {
  session_id: 'demo-session-breakfast-001',
  items: [
    {
      product_id: 'demo-001',
      name: 'Quaker Oats',
      brand: 'Quaker',
      quantity: 1,
      unit: '500g',
      price: 99,
      line_total: 99,
      reason: 'High-fibre, low-calorie breakfast grain',
      confidence: 0.97,
      image_url: null,
      substituted_for: null,
      reasoning_trail: [],
    },
    {
      product_id: 'demo-002',
      name: 'Poha (Flattened Rice)',
      brand: 'Top',
      quantity: 1,
      unit: '500g',
      price: 45,
      line_total: 45,
      reason: 'Light and nutritious breakfast option',
      confidence: 0.93,
      image_url: null,
      substituted_for: null,
      reasoning_trail: [],
    },
    {
      product_id: 'demo-003',
      name: 'Onion',
      brand: 'Fresh',
      quantity: 2,
      unit: 'pcs',
      price: 12,
      line_total: 24,
      reason: 'Used in poha and breakfast dishes',
      confidence: 0.9,
      image_url: null,
      substituted_for: null,
      reasoning_trail: [],
    },
    {
      product_id: 'demo-004',
      name: 'Banana',
      brand: 'Fresh',
      quantity: 4,
      unit: 'pcs',
      price: 8,
      line_total: 32,
      reason: 'Healthy breakfast fruit, natural energy',
      confidence: 0.95,
      image_url: null,
      substituted_for: null,
      reasoning_trail: [],
    },
    {
      product_id: 'demo-005',
      name: 'Low Fat Milk',
      brand: 'Amul',
      quantity: 1,
      unit: '500ml',
      price: 28,
      line_total: 28,
      reason: 'Protein source for oats or cereal',
      confidence: 0.96,
      image_url: null,
      substituted_for: null,
      reasoning_trail: [],
    },
    {
      product_id: 'demo-006',
      name: 'Green Chilli',
      brand: 'Fresh',
      quantity: 1,
      unit: '100g',
      price: 15,
      line_total: 15,
      reason: 'For tempering in poha',
      confidence: 0.88,
      image_url: null,
      substituted_for: null,
      reasoning_trail: [],
    },
  ],
  economical_items: [],
  substitutions: [],
  notes: ['Cart built for a healthy breakfast for 2 people'],
  reasoning_trail: ['Parsed intent: healthy breakfast for two people', 'Selected high-protein, low-calorie items'],
  total: 243,
  economical_total: 0,
  currency: 'INR',
  mode: 'voice',
  confidence: 0.95,
  degraded: false,
  remaining_budget: null,
  shortfall: null,
  clarification: null,
};

// After "remove onions from the cart"
const DEMO_CART_NO_ONIONS: CartResponse = {
  ...DEMO_CART_INITIAL,
  session_id: 'demo-session-breakfast-002',
  items: DEMO_CART_INITIAL.items.filter((i) => i.product_id !== 'demo-003'),
  total: 219,
  notes: ['Removed onions from the cart'],
};

// After "swap poha with oats" — poha removed, oats quantity bumped to 2
const DEMO_CART_SWAPPED: CartResponse = {
  ...DEMO_CART_NO_ONIONS,
  session_id: 'demo-session-breakfast-003',
  items: [
    ...DEMO_CART_NO_ONIONS.items.filter((i) => i.product_id !== 'demo-002'),
    {
      ...DEMO_CART_INITIAL.items[0], // Quaker Oats, now qty 2
      product_id: 'demo-001b',
      quantity: 2,
      line_total: 198,
      reason: 'Swapped poha with extra oats for higher fibre',
    },
  ],
  total: 372,
  notes: ['Swapped Poha with Quaker Oats'],
};
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  ctx: AppContext;
  onClose: () => void;
}

type Phase = 'idle' | 'listening' | 'processing' | 'confirming' | 'error';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
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
  rec.lang = 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}

const isNative = Capacitor.isNativePlatform();
const webSpeechSupported = !!getWebRecognition();
const speechSupported = isNative || webSpeechSupported || DEMO_MODE;


function parseFollowUp(text: string): { op: string; entity: string; quantity?: number } | null {
  const t = text.trim().toLowerCase();
  const add = t.match(/^(?:add|include|put in)\s+(?:(\d+)\s+)?(?:more\s+)?(.+)$/);
  if (add) return { op: 'add', entity: add[2].trim(), quantity: add[1] ? Number(add[1]) : 1 };
  const remove = t.match(/^(?:remove|delete|drop|take out)\s+(?:the\s+)?(.+)$/);
  if (remove) return { op: 'remove', entity: remove[1].trim() };
  return null;
}

export default function SpeakPanel({ ctx, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<'ok' | 'denied' | 'unsupported'>('ok');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // tracks which demo step we're on: 0 = first mic press, 1 = follow-up mic press
  const demoStepRef = useRef(0);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // patched demo carts with real image_urls fetched from catalog
  const demoCarts = useRef({ initial: DEMO_CART_INITIAL, noOnions: DEMO_CART_NO_ONIONS, swapped: DEMO_CART_SWAPPED });

  // In demo mode, fetch real image_urls from catalog for each item name
  useEffect(() => {
    if (!DEMO_MODE) return;

    const itemNames = DEMO_CART_INITIAL.items.map((i) => i.name);

    Promise.allSettled(
      itemNames.map((name) => searchCatalog(name, undefined, 1))
    ).then((results) => {
      // Build a name → image_url map from the first catalog hit per item
      const imageMap: Record<string, string | null> = {};
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          imageMap[itemNames[idx]] = result.value[0].image_url ?? null;
        }
      });

      const patchItems = (items: CartItem[]): CartItem[] =>
        items.map((item) => ({
          ...item,
          image_url: imageMap[item.name] ?? item.image_url,
        }));

      demoCarts.current = {
        initial: { ...DEMO_CART_INITIAL, items: patchItems(DEMO_CART_INITIAL.items) },
        noOnions: { ...DEMO_CART_NO_ONIONS, items: patchItems(DEMO_CART_NO_ONIONS.items) },
        swapped: { ...DEMO_CART_SWAPPED, items: patchItems(DEMO_CART_SWAPPED.items) },
      };
    }).catch(() => { /* silently fall back to null image_urls */ });
  }, []);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      recRef.current = null;
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      if (isNative) {
        import('@capacitor-community/speech-recognition').then(({ SpeechRecognition }) => {
          SpeechRecognition.removeAllListeners();
        }).catch(() => {});
      }
    };
  }, []);

  // ── Demo: animate words one-by-one then resolve ──────────────────────────
  const runDemoMic = (words: string[], onDone: (fullText: string) => void) => {
    setPhase('listening');
    setTranscript('');
    let built = '';
    let idx = 0;

    const next = () => {
      if (idx >= words.length) {
        // Brief pause after last word before "processing"
        demoTimerRef.current = setTimeout(() => onDone(built), 600);
        return;
      }
      built = idx === 0 ? words[idx] : built + ' ' + words[idx];
      idx++;
      setTranscript(built);
      demoTimerRef.current = setTimeout(next, 350);
    };

    demoTimerRef.current = setTimeout(next, 400);
  };

  const submit = async (text: string) => {
    if (!text.trim()) return;
    setPhase('processing');
    setError(null);
    try {
      const result = await postVoiceIntent(text.trim(), cart?.session_id ?? ctx.cart?.session_id);
      setCart(result);
      ctx.setCart(result);
      setPhase('confirming');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice request failed');
      setPhase('error');
    }
  };

  // ── Native Android: Capacitor SpeechRecognition plugin ──────────────────
  const startListeningNative = async () => {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

      const permStatus = await SpeechRecognition.requestPermissions();
      if (permStatus.speechRecognition !== 'granted') {
        setMicStatus('denied');
        return;
      }

      const { available } = await SpeechRecognition.available();
      if (!available) {
        setMicStatus('unsupported');
        return;
      }

      setMicStatus('ok');
      setTranscript('');
      setPhase('listening');

      await SpeechRecognition.removeAllListeners();

      await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        if (data.matches?.length) setTranscript(data.matches[0]);
      });

      await SpeechRecognition.addListener('listeningState', async (state: { status: string }) => {
        if (state.status === 'stopped') {
          await SpeechRecognition.removeAllListeners();
          setTranscript((current) => {
            if (current.trim()) void submit(current);
            else setPhase('idle');
            return current;
          });
        }
      });

      const result = await SpeechRecognition.start({
        language: 'en-IN',
        maxResults: 1,
        popup: false,
        partialResults: true,
      });

      if (result?.matches?.length) {
        await SpeechRecognition.removeAllListeners();
        const text = result.matches[0];
        setTranscript(text);
        void submit(text);
      }
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('permission') || msg.includes('not-allowed')) setMicStatus('denied');
      else setMicStatus('unsupported');
      setPhase('idle');
    }
  };

  const stopListeningNative = async () => {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      await SpeechRecognition.stop();
    } catch { /* ignore */ }
  };

  // ── Web: standard SpeechRecognition API ─────────────────────────────────
  const startListeningWeb = () => {
    if (recRef.current) {
      recRef.current.onend = null;
      recRef.current.onerror = null;
      recRef.current.onresult = null;
      recRef.current.stop();
      recRef.current = null;
    }

    const rec = getWebRecognition();
    if (!rec) { setMicStatus('unsupported'); return; }

    recRef.current = rec;
    setMicStatus('ok');
    setTranscript('');
    setMicStatus('ok');
    setPhase('listening');

    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setTranscript(text);
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicStatus('denied');
      setPhase('idle');
    };

    rec.onend = () => {
      setTranscript((current) => {
        if (current.trim()) void submit(current);
        else setPhase('idle');
        return current;
      });
    };

    rec.start();
  };

  const startListening = () => {
    if (DEMO_MODE) {
      const step = demoStepRef.current;
      if (step === 0) {
        // First press: "healthy breakfast for two people"
        runDemoMic(
          ['healthy', 'breakfast', 'for', 'two', 'people'],
          (_text) => {
            demoStepRef.current = 1;
            setPhase('processing');
            // Simulate brief API delay then show hardcoded cart
            demoTimerRef.current = setTimeout(() => {
              setCart(demoCarts.current.initial);
              ctx.setCart(demoCarts.current.initial);
              setPhase('confirming');
            }, 1200);
          },
        );
      } else {
        // Second press (follow-up): "remove onions from the cart"
        runDemoMic(
          ['remove', 'onions', 'from', 'the', 'cart'],
          (_text) => {
            demoStepRef.current = 2;
            setPhase('processing');
            demoTimerRef.current = setTimeout(() => {
              setCart(demoCarts.current.noOnions);
              ctx.setCart(demoCarts.current.noOnions);
              setPhase('confirming');
            }, 1000);
          },
        );
      }
      return;
    }
    if (isNative) { void startListeningNative(); return; }
    startListeningWeb();
  };

  const stopListening = () => {
    if (DEMO_MODE) {
      // In demo mode, stop just finishes the animation immediately
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      setPhase('idle');
      return;
    }
    if (isNative) { void stopListeningNative(); return; }
    recRef.current?.stop();
  };

  const sendFollowUp = async (text: string) => {
    if (!text.trim() || !cart) return;
    const parsed = parseFollowUp(text);
    setPhase('processing');
    setFollowUp('');
    try {
      const result = parsed
        ? await postCartOp(cart.session_id, parsed.op, parsed.entity, parsed.quantity)
        : await postVoiceIntent(text.trim(), cart.session_id);
      setCart(result);
      ctx.setCart(result);
      setPhase('confirming');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Follow-up failed');
      setPhase('error');
    }
  };

  const handleReplan = (updated: CartResponse) => {
    // In demo mode, intercept the "swap poha" chip → show hardcoded swapped cart
    if (DEMO_MODE) {
      const isSwap = !updated.items.find((i) => i.name.toLowerCase().includes('poha')) &&
        updated.items.find((i) => i.name.toLowerCase().includes('oat'));
      if (isSwap) {
        setCart(demoCarts.current.swapped);
        ctx.setCart(demoCarts.current.swapped);
        return;
      }
    }
    setCart(updated);
    ctx.setCart(updated);
  };

  // ----- error -----
  if (phase === 'error') {
    return (
      <ErrorState
        title="Voice request failed"
        description={error ?? 'Please try again or type your request.'}
        onRetry={() => setPhase('idle')}
      />
    );
  }

  // ----- processing -----
  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner size={28} />
        <p className="text-sm font-semibold text-dark">Building your cart…</p>
        {transcript && <p className="text-xs text-muted max-w-sm">"{transcript}"</p>}
      </div>
    );
  }

  // ----- confirming (result) -----
  if (phase === 'confirming' && cart) {
    return (
      <div className="space-y-4">
        <PanelResult
          cart={cart}
          onViewCart={() => { ctx.setCartOpen(true); onClose(); }}
          caption={transcript ? <>Heard: "{transcript}"</> : undefined}
        />

        {/* ReplanBar — refine / swap poha / cheaper etc. */}
        <ReplanBar cart={cart} onReplan={handleReplan} ctx={ctx} />

        {/* Follow-up mic / text bar */}
        <div className="border-t border-border pt-3">
          <label htmlFor="speak-followup" className="text-xs font-semibold text-dark">
            Follow up (e.g. "remove onions", "add more protein")
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              id="speak-followup"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendFollowUp(followUp)}
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

  // ----- idle / listening -----
  return (
    <div className="space-y-4">
      {/* Only shown when SpeechRecognition explicitly fires not-allowed */}
      {!DEMO_MODE && micStatus === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-sm font-semibold text-amber-800">Microphone access needed</p>
          <p className="text-xs text-amber-700 leading-snug">
            {isNative
              ? 'Allow microphone access in your phone\'s app settings, then try again.'
              : 'Tap the lock icon in Chrome\'s address bar → Permissions → enable Microphone.'}
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

      {/* Text input — always available */}
      <div className="flex gap-2">
        <input
          id="speak-typed"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(typed)}
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
