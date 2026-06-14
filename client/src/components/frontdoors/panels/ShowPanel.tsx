import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X, Send, Keyboard } from 'lucide-react';
import { Button, Spinner, ErrorState } from '../../../ui';
import type { AppContext } from '../../../App';
import { postVisionAnalyze, type CartResponse } from '../../../api/client';
import PanelResult from '../PanelResult';

interface Props {
  ctx: AppContext;
  onClose: () => void;
}

type Phase = 'idle' | 'processing' | 'confirming' | 'error';

export default function ShowPanel({ ctx, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Discard the raw image (revoke its object URL) when the panel unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const clearImage = () => pickFile(null);

  const submit = async () => {
    if (!file && !typed.trim()) return;
    setPhase('processing');
    setError(null);
    try {
      const result = await postVisionAnalyze(file, typed.trim() || undefined);
      setCart(result);
      ctx.setCart(result);
      setPhase('confirming');
      // privacy: drop the raw image once analyzed
      clearImage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image analysis failed');
      setPhase('error');
    }
  };

  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Couldn't read that image"
          description={error ?? 'The vision engine is unavailable. Type the dish name instead.'}
          onRetry={() => setPhase('idle')}
        />
        <div>
          <label htmlFor="show-typed-err" className="text-xs font-semibold text-dark flex items-center gap-1">
            <Keyboard size={13} aria-hidden="true" /> Type the dish instead
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              id="show-typed-err"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="e.g. paneer butter masala"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button variant="primary" size="md" onClick={submit} rightIcon={<Send size={15} />}>
              Build
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner size={28} />
        <p className="text-sm font-semibold text-dark">Recognizing the dish…</p>
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
        caption="Recreate this at home — here are the ingredients we matched."
      />
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Selected dish preview"
            className="w-full h-48 object-cover rounded-xl border border-border"
          />
          <button
            type="button"
            onClick={clearImage}
            aria-label="Remove image"
            className="absolute top-2 right-2 p-1.5 rounded-full bg-dark/60 text-white hover:bg-dark transition"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          data-autofocus
          className="w-full border-2 border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-2 text-muted hover:border-primary hover:text-primary-ink transition"
        >
          <Camera size={30} aria-hidden="true" />
          <span className="text-sm font-semibold">Snap or upload a dish photo</span>
          <span className="text-xs">JPG or PNG · processed in-memory, never stored</span>
        </button>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="md" fullWidth onClick={() => inputRef.current?.click()} leftIcon={<Upload size={16} />}>
          {preview ? 'Choose another' : 'Choose image'}
        </Button>
        <Button variant="primary" size="md" fullWidth onClick={submit} disabled={!file} rightIcon={<Send size={16} />}>
          Recreate
        </Button>
      </div>
    </div>
  );
}
