import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState = 'unavailable' | 'ready' | 'ios' | 'installed' | 'dev' | 'manual';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>('unavailable');

  useEffect(() => {
    // NOTE: We intentionally do NOT hide the install button when running as a
    // standalone PWA. The user may be viewing the app in Chrome browser while
    // the PWA is also installed — the button should always be visible for demo
    // purposes and to let users install on a different device/profile.

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
    // (already installed, browser suppressed the event, or criteria gap),
    // show a manual install option so the button is ALWAYS visible.
    const fallback = setTimeout(() => {
      setState((prev) => (prev === 'unavailable' ? 'manual' : prev));
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallback);
    };
  }, []);

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable' | 'dev' | 'manual'> => {
    if (state === 'ios' || state === 'manual') return 'ios'; // show manual instructions sheet
    if (state === 'dev') return 'dev';
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Do NOT set state to 'installed' — keep the button visible always
    setDeferredPrompt(null);
    return outcome;
  };

  return { state, triggerInstall };
}
