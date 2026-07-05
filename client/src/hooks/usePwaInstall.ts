import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState = 'unavailable' | 'ready' | 'ios' | 'installed' | 'dev' | 'manual';

/** True when the app is running as an installed PWA (standalone/fullscreen display mode). */
export function isRunningAsInstalledPwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari standalone
    (window.navigator as any).standalone === true
  );
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>('unavailable');

  useEffect(() => {
    // Running as installed PWA — hide install button entirely
    if (isRunningAsInstalledPwa()) {
      setState('installed');
      return;
    }

    // iOS Safari — no beforeinstallprompt, show manual instructions
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setState('ios');
      return;
    }

    // Chrome / Android / Edge — capture the deferred prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState('ready');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // In dev mode the service worker is disabled so beforeinstallprompt
    // never fires — mark as 'dev' so the button stays visible for testing
    if (import.meta.env.DEV) {
      setState('dev');
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }

    // Production fallback: if beforeinstallprompt hasn't fired after 4 s
    // (app already installed so Chrome won't re-prompt, or criteria not met yet)
    // show a manual install option so the button stays visible in the browser.
    const fallback = setTimeout(() => {
      setState((prev) => (prev === 'unavailable' ? 'manual' : prev));
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallback);
    };
  }, []);

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable' | 'dev' | 'manual'> => {
    if (state === 'ios' || state === 'manual') return 'ios';
    if (state === 'dev') return 'dev';
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome;
  };

  return { state, triggerInstall };
}
