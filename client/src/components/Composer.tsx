import { useState } from 'react';
import { Send, Mic, MicOff, Wallet } from 'lucide-react';
import type { AppContext } from '../App';
import { postOutcome, postVoiceIntent, postConstraint } from '../api/client';
import { Button, Card } from '../ui';

interface Props {
  ctx: AppContext;
}

type Mode = 'text' | 'voice' | 'budget';

const TABS: { id: Mode; label: string }[] = [
  { id: 'text', label: '✍️ Text' },
  { id: 'voice', label: '🎤 Voice' },
  { id: 'budget', label: '💰 Budget' },
];

export default function Composer({ ctx }: Props) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [budget, setBudget] = useState('500');
  const [servings, setServings] = useState('2');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const cart = await postOutcome(text.trim(), parseInt(servings) || undefined);
      ctx.setCart(cart);
      ctx.setCartOpen(true);
      setText('');
    } catch (err) {
      console.error('Outcome error:', err);
    }
    setLoading(false);
  };

  const handleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    setListening(true);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      setLoading(true);
      try {
        const cart = await postVoiceIntent(transcript);
        ctx.setCart(cart);
        ctx.setCartOpen(true);
      } catch (err) {
        console.error('Voice error:', err);
      }
      setLoading(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const cart = await postConstraint(parseFloat(budget) || 500, parseInt(servings) || 2, text.trim() || undefined);
      ctx.setCart(cart);
      ctx.setCartOpen(true);
    } catch (err) {
      console.error('Budget error:', err);
    }
    setLoading(false);
  };

  return (
    <Card padding="md">
      {/* Mode tabs */}
      <div className="flex gap-1 mb-4 bg-light-bg rounded-lg p-1" role="tablist" aria-label="Input mode">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
              mode === tab.id ? 'bg-surface text-primary-ink shadow-sm' : 'text-muted hover:text-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text mode */}
      {mode === 'text' && (
        <form onSubmit={handleTextSubmit}>
          <label htmlFor="composer-text" className="sr-only">Describe what you want</label>
          <div className="flex gap-2">
            <input
              id="composer-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='e.g. "Biryani for 4" or "I want to eat healthy this week"'
              className="flex-1 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-primary transition bg-surface text-dark"
              disabled={loading}
            />
            <Button type="submit" loading={loading} disabled={!text.trim()} leftIcon={<Send size={18} aria-hidden="true" />}>
              <span className="sr-only">Build cart</span>
            </Button>
          </div>
          <p className="text-xs text-muted mt-2">
            Describe a meal, a goal, or just a list. The engine builds your cart instantly.
          </p>
        </form>
      )}

      {/* Voice mode */}
      {mode === 'voice' && (
        <div className="text-center py-4">
          <button
            onClick={handleVoice}
            disabled={loading}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition mx-auto mb-3 ${
              listening ? 'bg-accent text-white animate-pulse' : 'bg-primary-light text-primary-ink hover:bg-primary hover:text-white'
            }`}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
          >
            {listening ? <MicOff size={32} aria-hidden="true" /> : <Mic size={32} aria-hidden="true" />}
          </button>
          <p className="text-sm text-muted" aria-live="polite">
            {listening ? 'Listening... speak now' : loading ? 'Processing...' : 'Tap to speak your grocery needs'}
          </p>
          <p className="text-xs text-muted mt-1">Try: "I need milk, bread, and eggs"</p>
        </div>
      )}

      {/* Budget mode */}
      {mode === 'budget' && (
        <form onSubmit={handleBudgetSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="composer-budget" className="text-xs font-medium text-dark mb-1 block">Budget (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">₹</span>
                <input
                  id="composer-budget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full border border-border rounded-lg pl-7 pr-3 py-2.5 text-sm outline-none focus:border-primary bg-surface text-dark"
                  min="50"
                />
              </div>
            </div>
            <div>
              <label htmlFor="composer-servings" className="text-xs font-medium text-dark mb-1 block">Servings</label>
              <input
                id="composer-servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary bg-surface text-dark"
                min="1"
              />
            </div>
          </div>
          <label htmlFor="composer-budget-text" className="sr-only">Optional context</label>
          <input
            id="composer-budget-text"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Optional: "dinner" or "breakfast for kids"'
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary bg-surface text-dark"
          />
          <Button type="submit" loading={loading} fullWidth leftIcon={<Wallet size={16} aria-hidden="true" />}>
            Build cart within budget
          </Button>
        </form>
      )}
    </Card>
  );
}
