import type {
  TournamentRecord,
  TournamentRepository
} from '../application/ports/tournament-repository.js';

const STORAGE_KEY = 'domino-tournament-manager::tournaments::v1';

function normalizeRecord(raw: TournamentRecord): TournamentRecord {
  return {
    ...raw,
    resultAuditLogs: Array.isArray(raw.resultAuditLogs) ? raw.resultAuditLogs : [],
    finalChampion: raw.finalChampion ?? null
  };
}

export class BrowserLocalRepository implements TournamentRepository {
  private readonly storage: Storage;

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage;
  }

  public async save(record: TournamentRecord): Promise<void> {
    const map = this.readAll();
    map[record.id] = normalizeRecord(structuredClone(record));
    this.writeAll(map);
  }

  public async getById(id: string): Promise<TournamentRecord | null> {
    const map = this.readAll();
    const found = map[id];
    return found ? normalizeRecord(structuredClone(found)) : null;
  }

  public async list(): Promise<TournamentRecord[]> {
    const map = this.readAll();
    return Object.values(map)
      .map((item) => normalizeRecord(structuredClone(item)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async delete(id: string): Promise<void> {
    const map = this.readAll();
    delete map[id];
    this.writeAll(map);
  }

  private readAll(): Record<string, TournamentRecord> {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, TournamentRecord>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private writeAll(map: Record<string, TournamentRecord>): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(map));
  }
}
