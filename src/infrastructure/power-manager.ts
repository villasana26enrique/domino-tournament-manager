import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './runtime-repository.js';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

let desiredKeepAwake = false;
let activeSentinel: WakeLockSentinelLike | null = null;
let visibilityBound = false;

async function acquireBrowserWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as NavigatorWithWakeLock;
  if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') return;
  if (activeSentinel && !activeSentinel.released) return;

  try {
    const sentinel = await nav.wakeLock.request('screen');
    if (!desiredKeepAwake) {
      await sentinel.release().catch(() => {});
      return;
    }
    activeSentinel = sentinel;
    sentinel.addEventListener?.('release', () => {
      if (activeSentinel === sentinel) {
        activeSentinel = null;
      }
    });
  } catch {
    // Wake Lock is best-effort (e.g. battery saver or unsupported browser)
  }
}

function handleVisibilityChange(): void {
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    desiredKeepAwake
  ) {
    void acquireBrowserWakeLock();
  }
}

function ensureVisibilityListener(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityBound = true;
}

export function resetKeepAwakeStateForTests(): void {
  desiredKeepAwake = false;
  activeSentinel = null;
  if (visibilityBound && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    visibilityBound = false;
  }
}

export async function setKeepAwake(enabled: boolean): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke('set_keep_awake', { enabled });
    } catch {
      // Power management is best-effort and must never break round execution
    }
    return;
  }

  desiredKeepAwake = enabled;
  if (enabled) {
    ensureVisibilityListener();
    await acquireBrowserWakeLock();
    return;
  }

  if (activeSentinel) {
    const toRelease = activeSentinel;
    activeSentinel = null;
    await toRelease.release().catch(() => {});
  }
}
