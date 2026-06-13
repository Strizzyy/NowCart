import { useState } from 'react';
import { Wallet, Users, Send } from 'lucide-react';
import { Button, Spinner, ErrorState } from '../../../ui';
import type { AppContext } from '../../../App';
import { postConstraint, type CartResponse } from '../../../api/client';
import PanelResult from '../PanelResult';

interface Props {
  ctx: AppContext;
  onClose: () => void;
}

type Phase = 'idle' | 'processing' | 'confirming' | 'error';

export default function ConstrainPanel({ ctx, onClose }: Props) {
  const [budget, setBudget] = useState('');
  const [servings, setServings] = useState('4');
  const [hint, setHint] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async () => {
    // inline validation — do NOT call the engine on invalid input
    const budgetNum = Number(budget);
    if (!budget.trim() || Number.isNaN(budgetNum) || budgetNum <= 0) {
      setFieldError('Enter a budget greater than ₹0.');
      return;
    }
    const servingsNum = Number(servings);
    if (!servings.trim() || Number.isNaN(servingsNum) || servingsNum < 1) {
      setFieldError('Enter how many people you are feeding (at least 1).');
      return;
    }
    setFieldError(null);
    setPhase('processing');
    setError(null);
    try {
      const result = await postConstraint(budgetNum, servingsNum, hint.trim() || undefined);
      setCart(result);
      ctx.setCart(result);
      setPhase('confirming');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Constraint request failed');
      setPhase('error');
    }
  };

  if (phase === 'error') {
    return (
      <ErrorState
        title="Couldn't build the cart"
        description={error ?? 'Please try again.'}
        onRetry={() => setPhase('idle')}
      />
    );
  }

  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner size={28} />
        <p className="text-sm font-semibold text-dark">Fitting the best cart to your budget…</p>
      </div>
    );
  }

  if (phase === 'confirming' && cart) {
    const overBudget = cart.shortfall != null && cart.shortfall > 0;
    return (
      <PanelResult
        cart={cart}
        onViewCart={() => {
          ctx.setCartOpen(true);
          onClose();
        }}
        caption={
          overBudget
            ? `Closest cart we could build — it's ₹${cart.shortfall!.toFixed(0)} over your budget.`
            : `Built within ₹${(cart.budget ?? Number(budget)).toFixed(0)} for ${servings} ${
                Number(servings) === 1 ? 'person' : 'people'
              }.`
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="budget" className="text-xs font-semibold text-dark flex items-center gap-1">
            <Wallet size={13} aria-hidden="true" /> Budget (₹)
          </label>
          <input
            id="budget"
            inputMode="numeric"
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="500"
            data-autofocus
            aria-invalid={!!fieldError}
            className="w-full mt-1.5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="servings" className="text-xs font-semibold text-dark flex items-center gap-1">
            <Users size={13} aria-hidden="true" /> People
          </label>
          <input
            id="servings"
            inputMode="numeric"
            value={servings}
            onChange={(e) => {
              setServings(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="4"
            className="w-full mt-1.5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="hint" className="text-xs font-semibold text-dark">
          What for? <span className="text-faint font-normal">(optional)</span>
        </label>
        <input
          id="hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. dinner tonight"
          className="w-full mt-1.5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {fieldError && (
        <p role="alert" className="text-sm text-red-700">
          {fieldError}
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth onClick={submit} rightIcon={<Send size={16} />}>
        Build my cart
      </Button>
      <p className="text-xs text-faint text-center">
        The engine works backwards from your money and headcount to a complete cart.
      </p>
    </div>
  );
}
