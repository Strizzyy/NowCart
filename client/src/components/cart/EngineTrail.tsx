import { useState } from 'react';
import { ChevronDown, Brain } from 'lucide-react';

interface Props {
  trail: string[];
}

/**
 * EngineTrail — cart-level comparison-collapse. Surfaces the Outcome Engine's
 * reasoning trail (exposed by the backend) so the single confident cart can be
 * explained on demand instead of dumping every candidate.
 */
export default function EngineTrail({ trail }: Props) {
  const [open, setOpen] = useState(false);
  if (!trail || trail.length === 0) return null;

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
          How the engine decided ({trail.length} steps)
        </span>
        <ChevronDown
          size={14}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ol className="px-4 pb-3 space-y-1.5 list-decimal list-inside">
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
