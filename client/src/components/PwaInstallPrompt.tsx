/**
 * PWA Install Prompt
 * Shows a native-style "Add to Home Screen" banner when the browser fires
 * the beforeinstallprompt event (Chrome/Android). Also shows a manual
 * iOS instruction since Safari doesn't support the event.
 */
import { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running as standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if dismissed before
    if (localStorage.getItem('pwa_prompt_dismissed')) return;

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setShowIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwa_prompt_dismissed', '1');
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('pwa_prompt_dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 sm:bottom-6">
      <div className="bg-dark border border-white/10 text-white rounded-2xl shadow-[var(--shadow-pop)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="NowCart" className="w-11 h-11 rounded-xl shrink-0" />
            <div>
              <p className="text-sm font-semibold leading-snug">Install NowCart</p>
              <p className="text-xs text-white/60 mt-0.5">
                {showIosHint && !deferredPrompt
                  ? 'Tap the share icon below, then "Add to Home Screen"'
                  : 'Add to your home screen for the full app experience'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/40 hover:text-white shrink-0 mt-0.5"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </button>
        </div>

        {showIosHint && !deferredPrompt ? (
          // iOS instruction — just show the share icon hint
          <div className="mt-3 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
            <Share size={14} className="text-primary shrink-0" />
            <p className="text-xs text-white/70">
              Tap <span className="text-white font-medium">Share</span> → <span className="text-white font-medium">Add to Home Screen</span>
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-primary hover:bg-orange-500 text-white text-sm font-semibold py-2.5 rounded-xl transition"
          >
            <Download size={15} />
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
