import { useState } from 'react';
import { ChevronDown, Brain } from 'lucide-react';

interface Props {
  trail: string[];
}

/**
 * Translate a raw backend reasoning step into plain English.
 * Strips internal details (scores, thresholds, node names) and
 * surfaces only what's meaningful to a customer.
 */
function humanStep(raw: string): string | null {
  const s = raw.toLowerCase();

  // Skip pure debug lines — never show to customers
  if (
    s.includes('confidence=') ||
    s.includes('threshold=') ||
    s.includes('hitl=') ||
    s.includes('counterfactuals:') ||
    s.includes('counterfactuals available') ||
    s.includes('bi-encoder') ||
    s.includes('cross-encoder') ||
    s.includes('rapidfuzz') ||
    s.includes('replan_count') ||
    s.includes('pre-set as') ||
    s.includes('intent pre-set')
  ) return null;

  // Intent classification
  if (s.includes("intent classified as 'budget'")) return 'You asked for a budget cart — engine picked products to fit your spend.';
  if (s.includes("intent classified as 'recipe'") || s.includes("intent classified as 'text'"))
    return 'Understood your request — identifying ingredients needed.';
  if (s.includes("intent classified as")) return 'Request understood — building your cart.';

  // Decompose
  if (s.includes('decomposed into')) {
    const m = raw.match(/(\d+) needs/);
    const count = m ? m[1] : 'several';
    const labelM = raw.match(/label=([^,)]+)/);
    const label = labelM ? labelM[1].trim() : null;
    if (label && label !== 'unknown') {
      return `Identified ${count} ingredients needed for ${label}.`;
    }
    return `Identified ${count} ingredients for your request.`;
  }

  // Match / retrieval
  if (s.includes('matched') && s.includes('needs')) {
    const m = raw.match(/Matched (\d+)\/(\d+)/);
    if (m) {
      const [, found, total] = m;
      const eco = raw.match(/economical=₹([\d.]+)/);
      const ecoAmt = eco ? `₹${Math.round(Number(eco[1]))}` : null;
      if (found === total) {
        return `Found all ${total} products in catalog${ecoAmt ? ` — budget option available at ${ecoAmt}` : ''}.`;
      }
      return `Found ${found} of ${total} products — the rest are suggested alternatives.`;
    }
  }

  // Replan
  if (s.includes('replan #') || s.includes('replan:')) {
    const feedbackM = raw.match(/feedback '([^']+)'/);
    const feedback = feedbackM ? feedbackM[1] : null;
    if (feedback) return `🔄 Applied your change: "${feedback}" — rebuilding cart.`;
    return 'Updating cart based on your feedback.';
  }

  // Subscription cart
  if (s.includes('subscription cart')) {
    const m = raw.match(/(\d+) items/);
    return `🔔 Added ${m ? m[1] : 'your'} recurring subscription items to cart.`;
  }

  // Subscribe prediction
  if (s.includes('subscribe prediction')) {
    const m = raw.match(/(\d+) purchase patterns/);
    return `Analysed your purchase history${m ? ` (${m[1]} patterns)` : ''} to predict what you need.`;
  }

  // Starter cart
  if (s.includes('starter cart')) return '🛒 Built a personalised starter cart based on your profile.';

  // New-user
  if (s.includes('new-user')) return '🛒 Created your first cart with household essentials.';

  // Generic fallback — only show if it looks like it adds value
  if (raw.length > 5 && !s.includes('=') && !s.includes('{')) return raw;

  return null;
}

export default function EngineTrail({ trail }: Props) {
  const [open, setOpen] = useState(false);
  if (!trail || trail.length === 0) return null;

  const steps = trail.map(humanStep).filter(Boolean) as string[];
  // Deduplicate (replan loops can repeat similar steps)
  const unique = steps.filter((s, i) => steps.indexOf(s) === i);

  if (unique.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-light-bg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-dark">
          <Brain size={13} className="text-primary-ink" aria-hidden="true" />
          How your cart was built
        </span>
        <ChevronDown
          size={14}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ol className="px-4 pb-3 space-y-2 list-none">
          {unique.map((step, i) => (
            <li key={i} className="text-xs text-muted leading-snug flex items-start gap-2">
              <span className="text-primary-ink font-bold shrink-0 mt-0.5">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
