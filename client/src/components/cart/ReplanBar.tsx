import { useState, useRef } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { postReplan, type CartResponse } from '../../api/client';
import type { AppContext } from '../../App';

interface Props {
  cart: CartResponse;
  onReplan: (cart: CartResponse) => void;
  ctx: AppContext;
}

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

const CHIPS = [
  { label: 'Cheaper',   value: 'make it cheaper' },
  { label: 'Vegan',     value: "I'm vegan, remove dairy and eggs" },
  { label: 'No onion',  value: 'no onion no garlic, jain' },
  { label: 'Protein',   value: 'add more high-protein items' },
  { label: 'Swap poha', value: 'swap poha for idli' },
];

export default function ReplanBar({ cart, onReplan, ctx }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (feedback: string) => {
    const trimmed = feedback.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const userId = resolveUserId(ctx?.user);

      // Build a meaningful text from current cart items — this gives the backend
      // full context of what's actually in the cart right now.
      const cartItemNames = cart.items.map(i => i.name);
      let originalText = cartItemNames.join(', ');

      // Fall back to reasoning trail if cart is empty (shouldn't happen normally)
      if (!originalText) {
        const decomposeStep = cart.reasoning_trail.find(t => t.includes('Decomposed') || t.includes('label='));
        if (decomposeStep) {
          const m = decomposeStep.match(/label=([^,)]+)/);
          if (m && m[1] !== 'unknown') originalText = m[1].trim();
        }
      }
      if (!originalText) originalText = 'grocery cart';

      const cartItemsForContext = cart.items.map(i => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }));

      const updated = await postReplan(originalText, trimmed, userId, undefined, cartItemsForContext);
      onReplan(updated);
      setInput('');
    } catch { /* keep stale cart */ }
    finally { setLoading(false); }
  };

  const showChips = focused || input.length > 0;

  return (
    <div className="space-y-1.5">
      {/* Quick chips — slide in when focused */}
      {showChips && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onMouseDown={(e) => e.preventDefault()} // keep input focus
              onClick={() => { setInput(c.value); inputRef.current?.focus(); }}
              className="shrink-0 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 active:scale-95 transition whitespace-nowrap"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Single-line input bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
        className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2"
      >
        <Sparkles size={14} className="text-indigo-400 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Refine: cheaper, vegan, swap…"
          className="flex-1 bg-transparent text-xs text-dark outline-none placeholder:text-indigo-400 min-w-0"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition"
          aria-label="Refine cart"
        >
          {loading
            ? <Loader2 size={11} className="animate-spin" />
            : <Send size={11} />}
        </button>
      </form>
    </div>
  );
}
