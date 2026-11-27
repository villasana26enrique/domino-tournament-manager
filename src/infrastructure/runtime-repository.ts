import type { TournamentRepository } from '../application/ports/tournament-repository.js';
import { BrowserLocalRepository } from './browser-local-repository.js';
import { TauriSqliteRepository } from './tauri-sqlite-repository.js';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createRuntimeRepository(): {
  repository: TournamentRepository;
  runtimeLabel: 'SQLite local (Tauri)' | 'Almacenamiento local del navegador';
} {
  if (isTauriRuntime()) {
    return {
      repository: new TauriSqliteRepository(),
      runtimeLabel: 'SQLite local (Tauri)'
    };
  }

  return {
    repository: new BrowserLocalRepository(window.localStorage),
    runtimeLabel: 'Almacenamiento local del navegador'
  };
}
