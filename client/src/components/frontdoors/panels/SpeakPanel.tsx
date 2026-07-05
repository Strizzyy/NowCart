import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send } from 'lucide-react';
import { Button, Spinner, ErrorState } from '../../../ui';
import type { AppContext } from '../../../App';
import { postVoiceIntent, postCartOp, type CartResponse } from '../../../api/client';
import PanelResult from '../PanelResult';

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

function getRecognition(): SpeechRecognitionLike | null {
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
  const speechSupported = !!getRecognition();

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      recRef.current = null;
    };
  }, []);

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

  const startListening = async () => {
    // Clean up any previous recognition instance
    if (recRef.current) {
      recRef.current.onend = null;
      recRef.current.onerror = null;
      recRef.current.onresult = null;
      recRef.current.stop();
      recRef.current = null;
    }

    if (!speechSupported) {
      setMicStatus('unsupported');
      return;
    }

    // getUserMedia first — keeps an active audio stream open while
    // SpeechRecognition runs. Required on some Android Chrome builds where
    // webkitSpeechRecognition silently fails without an active MediaStream.
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        stream = null; // permission denied — SpeechRecognition will surface the error
      }
    }

    const rec = getRecognition()!;
    recRef.current = rec;
    setTranscript('');
    setMicStatus('ok');
    setPhase('listening');

    const releaseStream = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };

    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setTranscript(text);
    };

    rec.onerror = (e) => {
      releaseStream();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicStatus('denied');
      setPhase('idle');
    };

    rec.onend = () => {
      releaseStream();
      setTranscript((current) => {
        if (current.trim()) void submit(current);
        else setPhase('idle');
        return current;
      });
    };

    rec.start();
  };

  const stopListening = () => recRef.current?.stop();

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
          onViewCart={() => {
            ctx.setCartOpen(true);
            onClose();
          }}
          caption={transcript ? <>Heard: "{transcript}"</> : undefined}
        />
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
            {speechSupported && micStatus === 'ok' && (
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
      {micStatus === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-sm font-semibold text-amber-800">Microphone access needed</p>
          <p className="text-xs text-amber-700 leading-snug">
            Tap the lock icon in Chrome's address bar → <strong>Permissions</strong> → enable
            <strong> Microphone</strong>. Then tap the mic button below.
          </p>
          <button
            onClick={() => setMicStatus('ok')}
            className="text-xs font-semibold text-amber-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {micStatus === 'unsupported' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Voice isn't supported in this browser. Type your request below.
        </div>
      )}

      {/* Mic button */}
      {speechSupported && (
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
          autoFocus={micStatus === 'unsupported'}
          className="flex-1 border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
        />
        <Button variant="primary" size="md" onClick={() => submit(typed)} rightIcon={<Send size={15} />}>
          Build
        </Button>
      </div>
    </div>
  );
}
