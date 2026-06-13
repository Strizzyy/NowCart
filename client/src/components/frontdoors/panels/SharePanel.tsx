import { useState } from 'react';
import { Link2, FileText, Send } from 'lucide-react';
import { Button, Spinner, ErrorState, Chip } from '../../../ui';
import type { AppContext } from '../../../App';
import { postShareParse, type CartResponse } from '../../../api/client';
import PanelResult from '../PanelResult';

interface Props {
  ctx: AppContext;
  onClose: () => void;
}

type Phase = 'idle' | 'processing' | 'confirming' | 'error';

const URL_RE = /^https?:\/\/\S+$/i;

export default function SharePanel({ ctx, onClose }: Props) {
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'link' | 'text'>('text');

  const isLink = URL_RE.test(value.trim());

  const submit = async () => {
    if (!value.trim()) return;
    const asLink = isLink;
    setSource(asLink ? 'link' : 'text');
    setPhase('processing');
    setError(null);
    try {
      const result = await postShareParse(asLink ? { url: value.trim() } : { text: value.trim() });
      if (!result.items.length) {
        setError('We couldn’t find any ingredients in that. Try pasting the recipe text directly.');
        setPhase('error');
        return;
      }
      setCart(result);
      ctx.setCart(result);
      setPhase('confirming');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the recipe.');
      setPhase('error');
    }
  };

  if (phase === 'error') {
    return (
      <ErrorState
        title="Couldn't parse that recipe"
        description={error ?? 'Try pasting the recipe text directly instead of a link.'}
        onRetry={() => setPhase('idle')}
      />
    );
  }

  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner size={28} />
        <p className="text-sm font-semibold text-dark">Reading the recipe…</p>
      </div>
    );
  }

  if (phase === 'confirming' && cart) {
    return (
      <PanelResult
        cart={cart}
        onViewCart={() => {
          ctx.setCartOpen(true);
          onClose();
        }}
        caption={
          <span className="flex items-center gap-1.5">
            From{' '}
            <Chip tone="info" size="xs" icon={source === 'link' ? <Link2 size={10} /> : <FileText size={10} />}>
              {source === 'link' ? 'a shared link' : 'pasted text'}
            </Chip>
          </span>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        {isLink ? (
          <Chip tone="info" size="xs" icon={<Link2 size={10} />}>Detected a link</Chip>
        ) : value.trim() ? (
          <Chip tone="neutral" size="xs" icon={<FileText size={10} />}>Pasted text</Chip>
        ) : (
          <span className="text-faint">Paste a recipe link or the full recipe text</span>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        data-autofocus
        placeholder="https://example.com/biryani-recipe  —  or paste the ingredients + steps here"
        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary resize-none h-32"
      />

      <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!value.trim()} rightIcon={<Send size={16} />}>
        Turn it into a cart
      </Button>
      <p className="text-xs text-faint text-center">
        Works with reel captions, blog links, or plain pasted recipes.
      </p>
    </div>
  );
}
