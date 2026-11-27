import { describe, expect, it } from 'vitest';
import { BrowserLocalRepository } from '../../src/infrastructure/browser-local-repository.js';
import { DEFAULT_TOURNAMENT_CONFIG } from '../../src/core/index.js';
import type { TournamentRecord } from '../../src/application/ports/tournament-repository.js';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  public get length(): number {
    return this.map.size;
  }
  public clear(): void {
    this.map.clear();
  }
  public getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  public key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  public removeItem(key: string): void {
    this.map.delete(key);
  }
  public setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('BrowserLocalRepository (TDD — Persistence Adapter)', () => {
  it('persists, reloads, lists and deletes tournament records across repository instances', async () => {
    const storage = new MemoryStorage();
    const repo1 = new BrowserLocalRepository(storage);

    const record: TournamentRecord = {
      id: 'trn-1',
      name: 'Copa Persistente',
      status: 'draft',
      seed: 'seed-abc',
      config: { ...DEFAULT_TOURNAMENT_CONFIG },
      overrideRounds: null,
      plannedRounds: 5,
      currentRoundNumber: 0,
      participants: [],
      plannedByesByRound: {},
      eliminationStages: null,
      ruleSnapshot: null,
      rounds: [],
      resultAuditLogs: [],
      finalChampion: null,
      createdAt: '2026-11-27T12:00:00.000Z',
      startedAt: null,
      completedAt: null,
      updatedAt: '2026-11-27T12:00:00.000Z'
    };

    await repo1.save(record);

    const repo2 = new BrowserLocalRepository(storage);
    const loaded = await repo2.getById('trn-1');
    expect(loaded).toEqual(record);

    const list = await repo2.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('Copa Persistente');

    await repo2.delete('trn-1');
    expect(await repo2.getById('trn-1')).toBeNull();
  });

  it('normalizes Phase 2 legacy records missing resultAuditLogs or finalChampion', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'domino-tournament-manager::tournaments::v1',
      JSON.stringify({
        'trn-legacy': {
          id: 'trn-legacy',
          name: 'Torneo Fase 2',
          status: 'draft',
          seed: 'seed-old',
          config: { ...DEFAULT_TOURNAMENT_CONFIG },
          overrideRounds: null,
          plannedRounds: 5,
          currentRoundNumber: 0,
          participants: [],
          plannedByesByRound: {},
          eliminationStages: null,
          ruleSnapshot: null,
          rounds: [],
          createdAt: '2026-11-27T12:00:00.000Z',
          startedAt: null,
          completedAt: null,
          updatedAt: '2026-11-27T12:00:00.000Z'
        }
      })
    );

    const repo = new BrowserLocalRepository(storage);
    const loaded = await repo.getById('trn-legacy');
    expect(loaded).not.toBeNull();
    expect(loaded!.resultAuditLogs).toEqual([]);
    expect(loaded!.finalChampion).toBeNull();
  });
});
