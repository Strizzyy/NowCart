import { useState } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { postReplan, type CartResponse } from '../../api/client';
import type { AppContext } from '../../App';

interface Props {
  cart: CartResponse;
  onReplan: (cart: CartResponse) => void;
  ctx: AppContext;
}

/** Map logged-in user to backend user_id */
function resolveUserId(user: { email?: string; userId?: string } | null | undefined): string {
  if (!user) return 'user-005';
  if (user.userId) return user.userId;
  const email = user.email;
  if (!email) return 'user-005';
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

const QUICK_ACTIONS = [
  { label: 'Make it cheaper', feedback: 'make it cheaper' },
  { label: 'I\'m vegan', feedback: "I'm vegan, remove all dairy and eggs" },
  { label: 'No onion/garlic', feedback: 'no onion no garlic, make it jain' },
  { label: 'More protein', feedback: 'add more high-protein items' },
];

export default function ReplanBar({ cart, onReplan, ctx }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (feedback: string) => {
    if (!feedback.trim() || loading) return;
    setLoading(true);
    try {
      const userId = resolveUserId(ctx?.user);
      // Try to extract the original text from reasoning trail
      // Look for "label=..." in the decomposition step
      let originalText = 'meal';
      const decomposeStep = cart.reasoning_trail.find(t => t.includes('Decomposed') || t.includes('label='));
      if (decomposeStep) {
        const labelMatch = decomposeStep.match(/label=([^,)]+)/);
        if (labelMatch && labelMatch[1] !== 'unknown') {
          originalText = labelMatch[1].trim();
        }
      }
      // If we still only have "meal", use the item names as context
      if (originalText === 'meal' && cart.items.length > 0) {
        originalText = cart.items.map(i => i.name).slice(0, 5).join(', ');
      }
      const updated = await postReplan(originalText, feedback, userId);
      onReplan(updated);
      setInput('');
      setExpanded(false);
    } catch {
      // ignore — UI will show stale cart
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
      >
        <MessageSquare size={14} />
        <span>Refine this cart — "make it cheaper", "I'm vegan", "swap the paneer"...</span>
      </button>
    );
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={14} className="text-indigo-700" />
        <p className="text-xs font-semibold text-indigo-800">Conversational Refinement</p>
      </div>

      {/* Quick action chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleSubmit(action.feedback)}
            disabled={loading}
            className="px-2.5 py-1 bg-white border border-indigo-200 rounded-full text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Free-form input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Or type anything: 'remove oil', 'swap paneer for tofu'..."
          className="flex-1 px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </form>

      <button
        onClick={() => setExpanded(false)}
        className="text-[10px] text-indigo-500 hover:text-indigo-700"
      >
        ← Close
      </button>
    </div>
  );
}
