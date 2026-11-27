import { invoke } from '@tauri-apps/api/core';
import type {
  TournamentRecord,
  TournamentRepository
} from '../application/ports/tournament-repository.js';

interface TauriTournamentEnvelope {
  id: string;
  name: string;
  status: string;
  seed: string;
  plannedRounds: number;
  currentRoundNumber: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  config: {
    format: string;
    schedulingMode: string;
    targetScore: number;
    roundDurationSeconds: number;
    warningBeforeEndSeconds: number;
    maxPhysicalTables: number | null;
    tieResolutionRule: string;
    finalTieBreaker: string;
    allowCompetitivePairing: boolean;
  };
  ruleSnapshot: unknown;
  eliminationStages: unknown;
  payloadJson: string;
}

function normalizeRecord(raw: TournamentRecord): TournamentRecord {
  return {
    ...raw,
    resultAuditLogs: Array.isArray(raw.resultAuditLogs) ? raw.resultAuditLogs : [],
    finalChampion: raw.finalChampion ?? null
  };
}

export class TauriSqliteRepository implements TournamentRepository {
  public async save(record: TournamentRecord): Promise<void> {
    const envelope: TauriTournamentEnvelope = {
      id: record.id,
      name: record.name,
      status: record.status,
      seed: record.seed,
      plannedRounds: record.plannedRounds,
      currentRoundNumber: record.currentRoundNumber,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      updatedAt: record.updatedAt,
      config: {
        format: record.config.format,
        schedulingMode: record.config.schedulingMode,
        targetScore: record.config.targetScore,
        roundDurationSeconds: record.config.roundDurationSeconds,
        warningBeforeEndSeconds: record.config.warningBeforeEndSeconds,
        maxPhysicalTables: record.config.maxPhysicalTables,
        tieResolutionRule: record.config.tieResolutionRule,
        finalTieBreaker: record.config.finalTieBreaker,
        allowCompetitivePairing: record.config.allowCompetitivePairing
      },
      ruleSnapshot: record.ruleSnapshot,
      eliminationStages: record.eliminationStages,
      payloadJson: JSON.stringify(record)
    };

    await invoke('save_tournament', { envelope });
  }

  public async getById(id: string): Promise<TournamentRecord | null> {
    const payload = await invoke<string | null>('get_tournament', { id });
    return payload ? normalizeRecord(JSON.parse(payload) as TournamentRecord) : null;
  }

  public async list(): Promise<TournamentRecord[]> {
    const payloads = await invoke<string[]>('list_tournaments');
    return payloads.map((raw) => normalizeRecord(JSON.parse(raw) as TournamentRecord));
  }

  public async delete(id: string): Promise<void> {
    await invoke('delete_tournament', { id });
  }
}
