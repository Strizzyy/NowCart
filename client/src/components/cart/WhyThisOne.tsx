import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { CartItem } from '../../api/client';

interface Props {
  item: CartItem;
}

/**
 * WhyThisOne — comparison-collapse disclosure (C2/C3). Instead of dumping
 * every candidate, the engine shows one pick + a one-line "why"; expanding
 * reveals the decision detail / reasoning trail for that pick.
 */
export default function WhyThisOne({ item }: Props) {
  const [open, setOpen] = useState(false);

  const trail = item.reasoning_trail && item.reasoning_trail.length > 0
    ? item.reasoning_trail
    : [
        item.reason || 'Best available match for this need.',
        `Confidence scored at ${Math.round(item.confidence * 100)}% from match quality, rating, and price.`,
        item.substituted_for
          ? 'Original pick was out of stock — swapped for this in-stock equivalent.'
          : 'In stock and ready for the fastest delivery slot.',
      ];

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-ink hover:underline"
      >
        <Sparkles size={11} aria-hidden="true" />
        Why this one
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ol className="mt-1.5 ml-1 space-y-1 border-l-2 border-primary-light pl-3">
          {trail.map((step, i) => (
            <li key={i} className="text-[11px] text-muted leading-snug">
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
