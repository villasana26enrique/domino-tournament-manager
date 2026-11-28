// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetKeepAwakeStateForTests,
  setKeepAwake
} from '../../src/infrastructure/power-manager.js';
import { registerPwaServiceWorker } from '../../src/infrastructure/pwa-register.js';

afterEach(() => {
  resetKeepAwakeStateForTests();
  vi.restoreAllMocks();
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe('Web Screen Wake Lock & PWA Service Worker Registration (TDD)', () => {
  it('acquires browser Screen Wake Lock without duplicates and releases cleanly on disable', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({
      released: false,
      release,
      addEventListener: vi.fn()
    });

    Object.defineProperty(window.navigator, 'wakeLock', {
      configurable: true,
      value: { request }
    });

    await setKeepAwake(true);
    await setKeepAwake(true); // already active -> should not re-request
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    await setKeepAwake(false);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('handles missing or rejected navigator.wakeLock gracefully without throwing', async () => {
    Object.defineProperty(window.navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: vi.fn().mockRejectedValue(new Error('Battery saver blocked wake lock'))
      }
    });

    await expect(setKeepAwake(true)).resolves.toBeUndefined();
    await expect(setKeepAwake(false)).resolves.toBeUndefined();
  });

  it('skips Service Worker registration inside Tauri runtime or unsupported browsers and registers ./sw.js on web', async () => {
    const register = vi.fn().mockResolvedValue({ scope: './' });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { register }
    });

    // Desktop Tauri must never register browser SW
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    await expect(registerPwaServiceWorker({ isProduction: true })).resolves.toBe(false);
    expect(register).not.toHaveBeenCalled();

    // Web production registers ./sw.js with scope ./
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    await expect(registerPwaServiceWorker({ isProduction: true })).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith('./sw.js', { scope: './' });
  });
});
