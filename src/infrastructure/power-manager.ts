import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './runtime-repository.js';

export async function setKeepAwake(enabled: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke('set_keep_awake', { enabled });
  } catch {
    // Power management is best-effort and must never break round execution
  }
}
