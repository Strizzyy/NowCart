import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { CartItem } from '../../api/client';

interface Props {
  item: CartItem;
}

/**
 * WhyThisOne — comparison-collapse disclosure (C2/C3).
 *
 * Shows a customer-friendly explanation for why this product was picked.
 * Never exposes raw scores or internal engine details.
 */

/** Map internal reason strings to clean customer-facing copy. */
function humaniseReason(reason: string | undefined, confidence: number): string {
  if (!reason) return 'Best available match for this ingredient.';

  const r = reason.toLowerCase();

  // Economical items
  if (r.includes('saves ₹') || r.includes('budget-friendly')) return reason; // already human
  if (r.includes('same as recommended')) return 'Same quality as the recommended pick — no cheaper alternative found.';
  if (r.includes('economical')) return 'Most affordable option in this category.';

  // Subscription items
  if (r.includes('subscription') || r.includes('recurring')) return reason; // already human

  // Substituted / OOS
  if (r.includes('out of stock') || r.includes('substituted')) {
    return 'Original choice was out of stock — swapped to the nearest in-stock equivalent.';
  }

  // New human-readable reasons from the backend
  if (r.includes('top-rated pick')) return 'Top-rated pick — highest match confidence for this ingredient.';
  if (r.includes('strong match')) return 'Strong match — verified against catalog name and category.';
  if (r.includes('good match')) return 'Good match — closest available product for this ingredient.';
  if (r.includes('best available')) return 'Best available option in catalog for this ingredient.';

  // Legacy score string — clean it up
  if (r.includes('score=') || r.includes('best match')) {
    if (confidence >= 0.85) return 'Top-rated pick — highest match confidence for this ingredient.';
    if (confidence >= 0.7)  return 'Strong match — verified against catalog name and category.';
    if (confidence >= 0.5)  return 'Good match — closest available product for this ingredient.';
    return 'Best available option in catalog for this ingredient.';
  }

  return reason;
}

export default function WhyThisOne({ item }: Props) {
  const [open, setOpen] = useState(false);

  // Build the disclosure trail — always customer-friendly, never raw scores
  const primaryReason = humaniseReason(item.reason, item.confidence);

  const deliveryLine = item.substituted_for
    ? 'Original pick was out of stock — swapped for this in-stock equivalent.'
    : 'In stock and ready for the fastest delivery slot.';

  const trail = (item.reasoning_trail && item.reasoning_trail.length > 0)
    // Filter out any engine-internal lines that leak scores or debug info
    ? item.reasoning_trail.filter(
        (t) => !t.includes('score=') && !t.includes('Decomposed') &&
               !t.includes('Matched ') && !t.includes('Confidence=')
      )
    : [primaryReason, deliveryLine];

  // If filtering left nothing, fall back to our two clean lines
  const displayTrail = trail.length > 0 ? trail : [primaryReason, deliveryLine];

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-ink hover:underline"
      >
        <Sparkles size={11} aria-hidden="true" />
        Why this item was suggested
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ol className="mt-1.5 ml-1 space-y-1 border-l-2 border-primary-light pl-3">
          {displayTrail.map((step, i) => (
            <li key={i} className="text-[11px] text-muted leading-snug">
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
