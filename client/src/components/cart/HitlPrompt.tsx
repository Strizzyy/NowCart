import { HelpCircle } from 'lucide-react';
import { Button } from '../../ui';

interface Props {
  question: string;
  /** proceed with the engine's current picks (dismiss the gate) */
  onProceed: () => void;
  /** reveal the lower-confidence picks so the user can review them */
  onShowAlternatives: () => void;
}

/**
 * HitlPrompt — human-in-the-loop gate (C3). Shown when the engine's overall
 * confidence is below threshold: instead of silently finalizing, it asks one
 * clarifying question and lets the user proceed or review alternatives.
 */
export default function HitlPrompt({ question, onProceed, onShowAlternatives }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
      <div className="flex items-start gap-2 mb-3">
        <HelpCircle size={16} className="text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm text-amber-900 leading-snug">{question}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onProceed}>
          Proceed with picks
        </Button>
        <Button variant="outline" size="sm" onClick={onShowAlternatives}>
          Review low-confidence items
        </Button>
      </div>
    </div>
  );
}
