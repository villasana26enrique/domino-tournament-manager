import type {
  TournamentRecord,
  TournamentRepository
} from '../application/ports/tournament-repository.js';

function cloneRecord(record: TournamentRecord): TournamentRecord {
  return structuredClone(record);
}

export class InMemoryTournamentRepository implements TournamentRepository {
  private readonly records = new Map<string, TournamentRecord>();

  public async save(record: TournamentRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  public async getById(id: string): Promise<TournamentRecord | null> {
    const found = this.records.get(id);
    return found ? cloneRecord(found) : null;
  }

  public async list(): Promise<TournamentRecord[]> {
    return [...this.records.values()]
      .map(cloneRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}
