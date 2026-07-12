import { useEffect, useRef, useState } from 'react';
import { Camera, FolderOpen, X, Send, Keyboard, RefreshCw } from 'lucide-react';
import { Button, Spinner, ErrorState } from '../../../ui';
import type { AppContext } from '../../../App';
import { postVisionAnalyze, type CartResponse } from '../../../api/client';
import PanelResult from '../PanelResult';

interface Props {
  ctx: AppContext;
  onClose: () => void;
}

type Phase = 'idle' | 'processing' | 'confirming' | 'error';

/** True when running on a device that likely has a native camera (phone/tablet). */
function isMobileDevice(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function ShowPanel({ ctx, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Hidden input: opens the device camera (mobile) or system camera dialog (desktop)
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Hidden input: opens the file manager / gallery (no capture attribute)
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Revoke object URL on unmount to avoid memory leaks
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
      // Privacy: drop the raw image once analyzed
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
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary min-h-[44px]"
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
      {/*
        Two hidden file inputs:
        1. cameraInputRef — capture="environment" → opens back camera on mobile,
           system camera dialog on desktop (ignored gracefully if not supported)
        2. galleryInputRef — no capture attr → opens Photos/Gallery on mobile,
           File Explorer/Finder on desktop
      */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {/* ── Image preview ── */}
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Selected dish preview"
            className="w-full max-h-56 object-cover rounded-xl border border-border"
          />
          <button
            type="button"
            onClick={clearImage}
            aria-label="Remove image"
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-dark/70 text-white hover:bg-dark active:scale-95 transition flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* ── Empty state drop zone (click opens gallery) ── */
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          data-autofocus
          className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-primary hover:text-primary-ink active:bg-primary-light/30 transition"
        >
          <Camera size={32} aria-hidden="true" />
          <span className="text-sm font-semibold">Tap to pick a dish photo</span>
          <span className="text-xs text-center px-4">JPG or PNG · processed in-memory, never stored</span>
        </button>
      )}

      {/* ── Source picker buttons ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Camera button — always shown; on mobile opens back camera, on desktop triggers camera dialog */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-4 px-3 text-dark hover:border-primary hover:bg-primary-light/40 active:scale-[0.97] transition min-h-[80px]"
          aria-label="Take a photo with camera"
        >
          <span className="w-10 h-10 rounded-xl bg-primary-light text-primary-ink flex items-center justify-center">
            <Camera size={20} aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold leading-tight text-center">
            {isMobile ? 'Open Camera' : 'Use Camera'}
          </span>
        </button>

        {/* File manager button — opens gallery on mobile, Finder/Explorer on desktop */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-4 px-3 text-dark hover:border-primary hover:bg-primary-light/40 active:scale-[0.97] transition min-h-[80px]"
          aria-label={isMobile ? 'Choose from gallery' : 'Browse files'}
        >
          <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
            <FolderOpen size={20} aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold leading-tight text-center">
            {isMobile ? 'Gallery / Files' : 'Browse Files'}
          </span>
        </button>
      </div>

      {/* ── Action row: replace image + submit ── */}
      {preview && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => galleryInputRef.current?.click()}
            leftIcon={<RefreshCw size={15} />}
          >
            Replace
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={submit}
            rightIcon={<Send size={15} />}
          >
            Recreate
          </Button>
        </div>
      )}

      {!preview && (
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={submit}
          disabled={!typed.trim()}
          rightIcon={<Send size={15} />}
          className="mt-1"
        >
          Recreate dish
        </Button>
      )}

      {/* ── Fallback: type dish name ── */}
      <div className="border-t border-border pt-3">
        <label htmlFor="show-typed" className="text-xs font-semibold text-dark flex items-center gap-1 mb-1.5">
          <Keyboard size={13} aria-hidden="true" /> No photo? Type the dish name
        </label>
        <div className="flex gap-2">
          <input
            id="show-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. masala dosa"
            className="flex-1 border border-border rounded-lg px-3 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
          />
          <Button variant="ghost" size="md" onClick={submit} disabled={!typed.trim()} rightIcon={<Send size={15} />}>
            Build
          </Button>
        </div>
      </div>
    </div>
  );
}
