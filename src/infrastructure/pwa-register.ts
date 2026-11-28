import { isTauriRuntime } from './runtime-repository.js';

export interface RegisterPwaOptions {
  isProduction?: boolean;
}

export async function registerPwaServiceWorker(
  options?: RegisterPwaOptions
): Promise<boolean> {
  if (isTauriRuntime()) return false;

  const isProd = options?.isProduction ?? import.meta.env.PROD;
  if (!isProd) return false;

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const sw = navigator.serviceWorker;
    const hadController = Boolean(sw.controller);
    if (
      hadController &&
      typeof window !== 'undefined' &&
      typeof sw.addEventListener === 'function'
    ) {
      let reloaded = false;
      sw.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    }
    await sw.register('./sw.js', { scope: './' });
    return true;
  } catch {
    return false;
  }
}
