/**
 * PWA Install Prompt — auto-triggered bottom banner.
 *
 * Behaviour:
 * - New users: shows automatically once when the browser fires beforeinstallprompt
 *   (Android/Chrome) or on iOS Safari. Shown every session until explicitly dismissed.
 * - Returning users who dismissed or installed: never shown again (persisted in localStorage).
 * - Header install button (Header.tsx) always available on demand regardless of this banner.
 */
import { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const STORAGE_KEY = 'pwa_prompt_dismissed';

export default function PwaInstallPrompt() {
  const { state, triggerInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed as a PWA — never show
    if (state === 'installed') return;
    // User dismissed or accepted before — never show again
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Show for new/returning-not-yet-installed users when browser is ready
    if (state === 'ready' || state === 'ios') {
      // Small delay so it doesn't flash immediately on page load
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const handleInstall = async () => {
    const outcome = await triggerInstall();
    // accepted → installed; ios → user follows manual steps; unavailable/dev → no-op
    if (outcome === 'accepted' || outcome === 'ios') {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    // Safe-area aware bottom position so it clears the iOS home indicator
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
      style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
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
            className="mt-3 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-95"
          >
            <Download size={15} aria-hidden="true" />
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
