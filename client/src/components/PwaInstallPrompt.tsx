/**
 * PWA Install Prompt — auto-triggered bottom banner.
 * Shown once when the browser fires beforeinstallprompt,
 * or on iOS Safari with manual "Add to Home Screen" instructions.
 * The header install button (Header.tsx) triggers install on demand.
 */
import { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export default function PwaInstallPrompt() {
  const { state, triggerInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (localStorage.getItem('pwa_prompt_dismissed')) return;
    if (state === 'ready' || state === 'ios') setVisible(true);
  }, [state, dismissed]);

  const handleInstall = async () => {
    const outcome = await triggerInstall();
    if (outcome === 'accepted') localStorage.setItem('pwa_prompt_dismissed', '1');
    setVisible(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
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
                {state === 'ios'
                  ? 'Tap the share icon below, then "Add to Home Screen"'
                  : 'Add to your home screen for the full app experience'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/40 hover:text-white shrink-0 mt-0.5 p-1"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </button>
        </div>

        {state === 'ios' ? (
          <div className="mt-3 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
            <Share size={14} className="text-primary shrink-0" />
            <p className="text-xs text-white/70">
              Tap <span className="text-white font-medium">Share</span> →{' '}
              <span className="text-white font-medium">Add to Home Screen</span>
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 rounded-xl transition"
          >
            <Download size={15} />
            {/* Install App */}
          </button>
        )}
      </div>
    </div>
  );
}
