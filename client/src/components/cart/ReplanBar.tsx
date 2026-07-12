import { useState, useRef } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { postReplan, postCartOp, type CartResponse } from '../../api/client';
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

// Chips that do a direct cart op (remove + add) instead of a full AI replan.
// This keeps the rest of the cart intact — only the swapped item changes.
type DirectSwapChip = {
  label: string;
  type: 'swap';
  remove: string;   // item name fragment to find in cart and remove
  add: string;      // item name to add
};

type ReplanChip = {
  label: string;
  type: 'replan';
  value: string;
};

type Chip = DirectSwapChip | ReplanChip;

const CHIPS: Chip[] = [
  { label: 'Cheaper',   type: 'replan', value: 'make it cheaper' },
  { label: 'Vegan',     type: 'replan', value: "I'm vegan, remove dairy and eggs" },
  { label: 'No onion',  type: 'replan', value: 'no onion no garlic, jain' },
  { label: 'Protein',   type: 'replan', value: 'add more high-protein items' },
  // Direct swap: remove poha, add oats — no full cart rebuild
  { label: 'Swap poha', type: 'swap', remove: 'poha', add: 'oats' },
];

export default function ReplanBar({ cart, onReplan, ctx }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [swapDone, setSwapDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Direct swap: remove the matching item, then add the replacement. */
  const handleDirectSwap = async (chip: DirectSwapChip) => {
    if (loading) return;
    setLoading(true);
    try {
      // Find the poha item in the current cart (case-insensitive partial match)
      const target = cart.items.find(i =>
        i.name.toLowerCase().includes(chip.remove.toLowerCase())
      );

      let updated: CartResponse = cart;

      if (target) {
        // Remove the matched item by exact name
        updated = await postCartOp(cart.session_id, 'remove', target.name);
      }

      // Add the replacement item
      updated = await postCartOp(updated.session_id, 'add', chip.add, 1);
      onReplan(updated);
      setSwapDone(true);
      setTimeout(() => setSwapDone(false), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Swap failed. Please try again.';
      setError(msg);
    }
    finally { setLoading(false); }
  };

  const handleSubmit = async (feedback: string) => {
    const trimmed = feedback.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const userId = resolveUserId(ctx?.user);

      // Strip any leading emoji + whitespace from a note string.
      const stripEmoji = (s: string) =>
        s.replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\s]+/u, '').trim();

      // System-generated notes we want to skip when hunting for the meal context.
      const isSystemNote = (n: string) => {
        const lower = n.toLowerCase();
        return (
          lower.includes('predicted') ||
          lower.includes('subscription') ||
          lower.includes('restock') ||
          lower.includes('starter cart') ||
          lower.includes('recurring') ||
          // Common emoji-prefix patterns used by the backend engines
          /^[\p{Emoji}\p{Emoji_Presentation}]/u.test(n)
        );
      };

      // Extract the meal context:
      //   1. Prefer a note that starts with the meal-dish emoji (🍽) — strip the emoji.
      //   2. Fall back to the first non-system note.
      //   3. Last resort: join the first 3 item names so the backend has some context.
      const notes = Array.isArray(cart.notes) ? cart.notes : [];
      const mealNote = notes.find(n => /^🍽/u.test(n));
      const mealContext = mealNote
        ? stripEmoji(mealNote)
        : notes.find(n => n.trim() !== '' && !isSystemNote(n)) ??
          cart.items.slice(0, 3).map(i => i.name).join(', ');

      // The `text` field sent to the backend: use the meal context (always non-empty
      // after the extraction above); fall back to the feedback itself if somehow empty.
      const mealText = mealContext || trimmed;

      const cartItemsForContext = cart.items.map(i => ({
        product_id: i.product_id,
        name: i.name,
        brand: i.brand ?? '',
        price: i.price,
        quantity: i.quantity,
        image_url: i.image_url ?? null,
      }));

      const updated = await postReplan(
        mealText,
        trimmed,
        userId,
        undefined,
        cartItemsForContext,
        mealContext,   // pass meal context explicitly so backend augment prompt uses it
      );
      onReplan(updated);
      setInput('');
      setError('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Replan failed. Please try again.';
      setError(msg);
    }
    finally { setLoading(false); }
  };

  const handleChipClick = (chip: Chip) => {
    if (chip.type === 'swap') {
      void handleDirectSwap(chip);
    } else {
      // Auto-submit replan chips immediately instead of just pre-filling
      void handleSubmit(chip.value);
    }
  };

  const showChips = focused || input.length > 0;

  return (
    <div className="space-y-1.5">
      {showChips && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleChipClick(c)}
              disabled={loading}
              className={[
                'shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition whitespace-nowrap active:scale-95',
                c.type === 'swap' && swapDone
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-700'
                  : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100',
                loading ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {c.type === 'swap' && loading ? '⏳ Swapping…' : c.type === 'swap' && swapDone ? '✓ Swapped!' : c.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
        className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2"
      >
        <Sparkles size={14} className="text-indigo-400 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); if (error) setError(''); }}
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

      {error && (
        <p className="text-[11px] text-red-600 px-1">{error}</p>
      )}
    </div>
  );
}
