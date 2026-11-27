import { z } from 'zod';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  DomainValidationError,
  InvalidTournamentStateError,
  SeededRng,
  buildTournamentHistory,
  calculateStandings,
  computeTimerSnapshot,
  forceExpireRoundTimer,
  generateRound,
  markExpiredFired,
  markWarningFired,
  pauseRoundTimer as pauseTimerState,
  planTournament,
  replanRemainingByes,
  resolveFinalChampion,
  resolveStageAdvancement,
  startOrResumeRoundTimer,
  substituteParticipant,
  validateMatchScore,
  validateTournamentConfig,
  type CompletedRound,
  type MatchEndReason,
  type Participant,
  type RankingMode,
  type RecordedMatch,
  type RoundTimerState,
  type StandingRow,
  type TournamentConfig,
  type TournamentPlan
} from '../core/index.js';
import type {
  PersistedMatch,
  PersistedRound,
  ResultAuditLog,
  TournamentRecord,
  TournamentRepository
} from './ports/tournament-repository.js';

export interface TournamentServiceDependencies {
  repository: TournamentRepository;
  generateId?: (prefix: string) => string;
  nowIso?: () => string;
  nowUtcMs?: () => number;
}

export interface RecordMatchResultInput {
  matchId: string;
  pairAScore: number;
  pairBScore: number;
  endedBy: MatchEndReason;
  reason?: string;
}

export interface SyncTimerOutcome {
  record: TournamentRecord;
  round: PersistedRound;
  warningTriggered: boolean;
  expiredTriggered: boolean;
}

export interface TournamentBackupPayload {
  schemaVersion: '1.0.0';
  app: 'Domino Tournament Manager';
  exportedAt: string;
  tournaments: TournamentRecord[];
}

export interface BackupImportSummary {
  importedCount: number;
  updatedCount: number;
  totalAfter: number;
}

const backupPayloadSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  app: z.literal('Domino Tournament Manager'),
  exportedAt: z.string().min(1),
  tournaments: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      status: z.enum(['draft', 'ready', 'in_progress', 'completed', 'cancelled']),
      seed: z.string().min(1),
      config: z.record(z.unknown()),
      plannedRounds: z.number().int().min(1),
      currentRoundNumber: z.number().int().min(0),
      participants: z.array(z.record(z.unknown())),
      rounds: z.array(z.record(z.unknown())),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1)
    }).passthrough()
  )
});

function defaultGenerateId(prefix: string): string {
  const randomPart =
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return `${prefix}-${randomPart}`;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase('es');
}

function renumberParticipants(participants: readonly Participant[]): Participant[] {
  return participants.map((p, index) => ({
    ...p,
    number: index + 1
  }));
}

function toTimerState(round: PersistedRound, warningBeforeEndSeconds: number): RoundTimerState {
  return {
    durationSeconds: round.durationSeconds,
    warningBeforeEndSeconds,
    elapsedBeforeRunMs: round.elapsedBeforeRunMs,
    timerStartedAtUtcMs: round.timerStartedAtUtcMs,
    warningFiredAtUtcMs: round.warningFiredAtUtcMs,
    expiredFiredAtUtcMs: round.expiredFiredAtUtcMs
  };
}

function applyTimerState(round: PersistedRound, timer: RoundTimerState): PersistedRound {
  return {
    ...round,
    elapsedBeforeRunMs: timer.elapsedBeforeRunMs,
    timerStartedAtUtcMs: timer.timerStartedAtUtcMs,
    warningFiredAtUtcMs: timer.warningFiredAtUtcMs,
    expiredFiredAtUtcMs: timer.expiredFiredAtUtcMs
  };
}

function getRankingMode(record: TournamentRecord): RankingMode {
  if (record.ruleSnapshot) {
    return record.ruleSnapshot.parameters.rankingMode;
  }
  return record.config.format === 'rounds_all_play' ? 'equal_games' : 'unequal_games';
}

function toCompletedRounds(
  record: TournamentRecord,
  options?: { includePartialMatches?: boolean }
): CompletedRound[] {
  const includePartial = options?.includePartialMatches ?? false;

  return record.rounds
    .filter((r) => r.status === 'completed' || (includePartial && r.matches.some((m) => m.status === 'completed')))
    .map((r) => {
      const completedMatches: RecordedMatch[] = r.matches
        .filter((m) => m.status === 'completed' && m.pairAScore !== null && m.pairBScore !== null && m.outcome !== null)
        .map((m) => ({
          matchId: m.id,
          roundNumber: r.roundNumber,
          tableNumber: m.tableNumber,
          pairA: m.pairA,
          pairB: m.pairB,
          status: 'completed',
          pairAScore: m.pairAScore!,
          pairBScore: m.pairBScore!,
          winnerPair: m.winnerPair,
          outcome: m.outcome!,
          endedBy: m.endedBy ?? 'target_score'
        }));

      return {
        roundNumber: r.roundNumber,
        phase: r.phase,
        stageName: r.stageName,
        matches: completedMatches,
        byes: r.byes,
        eliminatedParticipantIds: r.eliminatedParticipantIds,
        metrics: r.metrics,
        explanations: r.explanations
      };
    });
}

export class TournamentService {
  private readonly repository: TournamentRepository;
  private readonly generateId: (prefix: string) => string;
  private readonly nowIso: () => string;
  private readonly nowUtcMs: () => number;

  constructor(deps: TournamentServiceDependencies) {
    this.repository = deps.repository;
    this.generateId = deps.generateId ?? defaultGenerateId;
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
    this.nowUtcMs = deps.nowUtcMs ?? (() => Date.now());
  }

  public async listTournaments(): Promise<TournamentRecord[]> {
    const items = await this.repository.list();
    return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async getTournament(id: string): Promise<TournamentRecord | null> {
    return this.repository.getById(id);
  }

  public async createDraft(name: string): Promise<TournamentRecord> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new DomainValidationError('El nombre del torneo no puede estar vacío.');
    }
    if (trimmed.length > 80) {
      throw new DomainValidationError('El nombre del torneo no puede superar los 80 caracteres.');
    }

    const now = this.nowIso();
    const record: TournamentRecord = {
      id: this.generateId('trn'),
      name: trimmed,
      status: 'draft',
      seed: this.generateId('seed'),
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
      createdAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now
    };

    await this.repository.save(record);
    return record;
  }

  public async renameTournament(tournamentId: string, newName: string): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new DomainValidationError('El nombre del torneo no puede estar vacío.');
    }

    const updated: TournamentRecord = {
      ...record,
      name: trimmed,
      updatedAt: this.nowIso()
    };
    await this.repository.save(updated);
    return updated;
  }

  public async addParticipant(
    tournamentId: string,
    displayName: string
  ): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      throw new DomainValidationError('El nombre del participante no puede estar vacío.');
    }

    const key = normalizeNameKey(trimmed);
    const exists = record.participants.some((p) => normalizeNameKey(p.displayName) === key);
    if (exists) {
      throw new DomainValidationError(`Participante duplicado: "${trimmed}" ya está registrado.`);
    }

    const participant: Participant = {
      id: this.generateId('par'),
      playerId: this.generateId('ply'),
      number: record.participants.length + 1,
      displayName: trimmed,
      status: 'active',
      withdrawnAfterRound: null,
      eliminatedAfterRound: null
    };

    const updated: TournamentRecord = {
      ...record,
      participants: [...record.participants, participant],
      updatedAt: this.nowIso()
    };

    await this.repository.save(updated);
    return updated;
  }

  public async addParticipantsBulk(
    tournamentId: string,
    rawLines: string
  ): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const existingKeys = new Set(record.participants.map((p) => normalizeNameKey(p.displayName)));
    const nextList = [...record.participants];

    for (const rawLine of rawLines.split(/\r?\n/)) {
      const cleaned = rawLine.trim();
      if (cleaned.length === 0) continue;
      const key = normalizeNameKey(cleaned);
      if (existingKeys.has(key)) continue;

      existingKeys.add(key);
      nextList.push({
        id: this.generateId('par'),
        playerId: this.generateId('ply'),
        number: nextList.length + 1,
        displayName: cleaned,
        status: 'active',
        withdrawnAfterRound: null,
        eliminatedAfterRound: null
      });
    }

    const updated: TournamentRecord = {
      ...record,
      participants: renumberParticipants(nextList),
      updatedAt: this.nowIso()
    };
    await this.repository.save(updated);
    return updated;
  }

  public async updateParticipantName(
    tournamentId: string,
    participantId: string,
    newName: string
  ): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new DomainValidationError('El nombre del participante no puede estar vacío.');
    }

    const key = normalizeNameKey(trimmed);
    const duplicate = record.participants.some(
      (p) => p.id !== participantId && normalizeNameKey(p.displayName) === key
    );
    if (duplicate) {
      throw new DomainValidationError(`Ya existe otro participante llamado "${trimmed}".`);
    }

    const updated: TournamentRecord = {
      ...record,
      participants: record.participants.map((p) =>
        p.id === participantId ? { ...p, displayName: trimmed } : p
      ),
      updatedAt: this.nowIso()
    };

    await this.repository.save(updated);
    return updated;
  }

  public async removeParticipant(
    tournamentId: string,
    participantId: string
  ): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const remaining = record.participants.filter((p) => p.id !== participantId);

    const updated: TournamentRecord = {
      ...record,
      participants: renumberParticipants(remaining),
      updatedAt: this.nowIso()
    };
    await this.repository.save(updated);
    return updated;
  }

  public async updateConfig(
    tournamentId: string,
    patch: Partial<TournamentConfig>,
    overrideRounds?: number | null
  ): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const mergedConfig = validateTournamentConfig({
      ...record.config,
      ...patch
    });

    const updated: TournamentRecord = {
      ...record,
      config: mergedConfig,
      overrideRounds: overrideRounds === undefined ? record.overrideRounds : overrideRounds,
      updatedAt: this.nowIso()
    };

    await this.repository.save(updated);
    return updated;
  }

  public async regenerateSeed(tournamentId: string): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    let nextSeed = this.generateId('seed');
    if (nextSeed === record.seed) {
      nextSeed = `${nextSeed}-r`;
    }

    const updated: TournamentRecord = {
      ...record,
      seed: nextSeed,
      updatedAt: this.nowIso()
    };
    await this.repository.save(updated);
    return updated;
  }

  public async previewTournament(
    tournamentId: string,
    options?: { strictRequestedFormat?: boolean }
  ): Promise<TournamentPlan> {
    const record = await this.requireTournament(tournamentId);
    const activeCount = record.participants.filter((p) => p.status === 'active').length;

    if (activeCount < 4) {
      throw new DomainValidationError(
        `Se requieren al menos 4 participantes para generar la previsualización (actuales: ${activeCount}).`
      );
    }

    const effectiveConfig = this.resolveEffectiveConfig(
      record.config,
      activeCount,
      options?.strictRequestedFormat ?? false
    );

    const overrideRounds =
      effectiveConfig.format === 'rounds_all_play' && record.overrideRounds !== null
        ? record.overrideRounds
        : undefined;

    return planTournament({
      participants: record.participants,
      config: effectiveConfig,
      seed: record.seed,
      ...(overrideRounds !== undefined ? { overrideRounds } : {})
    });
  }

  public async confirmAndStartTournament(tournamentId: string): Promise<TournamentRecord> {
    const record = await this.requireEditableDraft(tournamentId);
    const plan = await this.previewTournament(tournamentId);
    const now = this.nowIso();

    const firstRound = this.buildPersistedRound({
      roundNumber: 1,
      phase: plan.firstRoundPreview.phase ?? 'regular',
      stageName: plan.firstRoundPreview.stageName ?? 'Ronda 1',
      durationSeconds: plan.config.roundDurationSeconds,
      matches: plan.firstRoundPreview.matches,
      byes: plan.firstRoundPreview.byes,
      metrics: plan.firstRoundPreview.metrics,
      explanations: plan.firstRoundPreview.explanations
    });

    const started: TournamentRecord = {
      ...record,
      status: 'in_progress',
      config: plan.config,
      plannedRounds: plan.selectedRounds,
      currentRoundNumber: 1,
      plannedByesByRound: plan.plannedByesByRound,
      eliminationStages: plan.eliminationStages,
      ruleSnapshot: plan.rulesDocument,
      rounds: [firstRound],
      resultAuditLogs: [],
      finalChampion: null,
      startedAt: now,
      updatedAt: now
    };

    await this.repository.save(started);
    return started;
  }

  public async deleteDraft(tournamentId: string): Promise<void> {
    const record = await this.requireTournament(tournamentId);
    if (record.status !== 'draft' && record.status !== 'ready') {
      throw new InvalidTournamentStateError(
        'Solo se pueden eliminar torneos en estado borrador.'
      );
    }
    await this.repository.delete(tournamentId);
  }

  public async deleteTournament(tournamentId: string): Promise<void> {
    await this.requireTournament(tournamentId);
    await this.repository.delete(tournamentId);
  }

  public async exportBackupPayload(): Promise<TournamentBackupPayload> {
    const tournaments = await this.listTournaments();
    return {
      schemaVersion: '1.0.0',
      app: 'Domino Tournament Manager',
      exportedAt: this.nowIso(),
      tournaments
    };
  }

  public async importBackupPayload(rawJson: string): Promise<BackupImportSummary> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawJson);
    } catch {
      throw new DomainValidationError(
        'El archivo de respaldo contiene un JSON inválido.'
      );
    }

    const validated = backupPayloadSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new DomainValidationError(
        'El formato del archivo de respaldo es inválido o no pertenece a Domino Tournament Manager.'
      );
    }

    const existingList = await this.repository.list();
    const existingIds = new Set(existingList.map((t) => t.id));

    let importedCount = 0;
    let updatedCount = 0;

    for (const rawRecord of validated.data.tournaments) {
      const normalized = {
        ...(rawRecord as unknown as TournamentRecord),
        resultAuditLogs: Array.isArray((rawRecord as Record<string, unknown>).resultAuditLogs)
          ? ((rawRecord as unknown as TournamentRecord).resultAuditLogs ?? [])
          : [],
        finalChampion:
          ((rawRecord as Record<string, unknown>).finalChampion as TournamentRecord['finalChampion']) ??
          null
      };

      await this.repository.save(normalized);
      if (existingIds.has(normalized.id)) {
        updatedCount += 1;
      } else {
        existingIds.add(normalized.id);
        importedCount += 1;
      }
    }

    const afterList = await this.repository.list();
    return {
      importedCount,
      updatedCount,
      totalAfter: afterList.length
    };
  }

  // =========================================================================
  // Fase 3 — Cronómetro persistente, resultados, avance, sustitutos y tabla
  // =========================================================================

  public async startRoundTimer(tournamentId: string): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const round = this.requireCurrentRound(record);

    if (round.status === 'completed' || round.status === 'time_expired') {
      throw new InvalidTournamentStateError(
        'El cronómetro no puede iniciarse cuando la ronda ya finalizó o expiró su tiempo.'
      );
    }

    const nowUtc = this.nowUtcMs();
    const timer = startOrResumeRoundTimer(
      toTimerState(round, record.config.warningBeforeEndSeconds),
      nowUtc
    );

    const updatedRound: PersistedRound = {
      ...applyTimerState(round, timer),
      status: 'in_progress',
      startedAt: round.startedAt ?? this.nowIso()
    };

    return this.saveUpdatedRound(record, updatedRound);
  }

  public async pauseRoundTimer(tournamentId: string): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const round = this.requireCurrentRound(record);

    if (round.timerStartedAtUtcMs === null) {
      return record;
    }

    const nowUtc = this.nowUtcMs();
    const timer = pauseTimerState(
      toTimerState(round, record.config.warningBeforeEndSeconds),
      nowUtc
    );

    const updatedRound: PersistedRound = {
      ...applyTimerState(round, timer),
      status: round.matches.some((m) => m.status === 'completed') ? 'recording_results' : 'paused'
    };

    return this.saveUpdatedRound(record, updatedRound);
  }

  public async syncRoundTimer(tournamentId: string): Promise<SyncTimerOutcome> {
    const record = await this.requireActiveTournament(tournamentId);
    const round = this.requireCurrentRound(record);

    const nowUtc = this.nowUtcMs();
    let timer = toTimerState(round, record.config.warningBeforeEndSeconds);
    const snap = computeTimerSnapshot(timer, nowUtc);

    let warningTriggered = false;
    let expiredTriggered = false;
    let nextStatus = round.status;

    if (snap.shouldFireExpired) {
      timer = markExpiredFired(timer, nowUtc);
      expiredTriggered = true;
      if (nextStatus !== 'completed' && nextStatus !== 'recording_results') {
        nextStatus = 'time_expired';
      }
    } else if (snap.shouldFireWarning) {
      timer = markWarningFired(timer, nowUtc);
      warningTriggered = true;
    }

    if (!warningTriggered && !expiredTriggered) {
      return { record, round, warningTriggered: false, expiredTriggered: false };
    }

    const updatedRound: PersistedRound = {
      ...applyTimerState(round, timer),
      status: nextStatus
    };
    const saved = await this.saveUpdatedRound(record, updatedRound);
    const savedRound = this.requireCurrentRound(saved);
    return {
      record: saved,
      round: savedRound,
      warningTriggered,
      expiredTriggered
    };
  }

  public async expireRoundTimerNow(tournamentId: string): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const round = this.requireCurrentRound(record);

    if (round.status === 'completed') {
      throw new InvalidTournamentStateError('La ronda ya fue cerrada.');
    }

    const nowUtc = this.nowUtcMs();
    const timer = forceExpireRoundTimer(
      toTimerState(round, record.config.warningBeforeEndSeconds),
      nowUtc
    );

    const updatedRound: PersistedRound = {
      ...applyTimerState(round, timer),
      status: 'time_expired'
    };

    return this.saveUpdatedRound(record, updatedRound);
  }

  public async recordMatchResult(
    tournamentId: string,
    input: RecordMatchResultInput
  ): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const round = this.requireCurrentRound(record);

    const targetMatch = round.matches.find((m) => m.id === input.matchId);
    if (!targetMatch) {
      throw new DomainValidationError(
        `No se encontró la mesa "${input.matchId}" en la ronda actual.`
      );
    }

    const wasCompleted = targetMatch.status === 'completed';
    const trimmedReason = input.reason?.trim() ?? '';
    if (wasCompleted && trimmedReason.length === 0) {
      throw new DomainValidationError(
        'Para corregir un resultado ya confirmado debes indicar un motivo administrativo.'
      );
    }

    const validation = validateMatchScore({
      pairAScore: input.pairAScore,
      pairBScore: input.pairBScore,
      targetScore: record.config.targetScore,
      endedBy: input.endedBy
    });

    if (!validation.valid || validation.outcome === null) {
      throw new DomainValidationError(validation.errors.join(' '));
    }

    const nowIso = this.nowIso();
    const updatedMatches: PersistedMatch[] = round.matches.map((m) =>
      m.id === targetMatch.id
        ? {
            ...m,
            status: 'completed',
            pairAScore: input.pairAScore,
            pairBScore: input.pairBScore,
            winnerPair: validation.winnerPair,
            outcome: validation.outcome,
            endedBy: input.endedBy,
            recordedAt: nowIso
          }
        : m
    );

    const allCompleted = updatedMatches.every((m) => m.status === 'completed');
    let nextTimer = toTimerState(round, record.config.warningBeforeEndSeconds);
    if (allCompleted && nextTimer.timerStartedAtUtcMs !== null) {
      nextTimer = pauseTimerState(nextTimer, this.nowUtcMs());
    }

    const nextRoundStatus =
      round.status === 'in_progress' && !allCompleted ? 'in_progress' : 'recording_results';

    const updatedRound: PersistedRound = {
      ...applyTimerState(round, nextTimer),
      status: nextRoundStatus,
      matches: updatedMatches
    };

    const auditEntry: ResultAuditLog = {
      id: this.generateId('aud'),
      roundNumber: round.roundNumber,
      matchId: targetMatch.id,
      tableNumber: targetMatch.tableNumber,
      action: wasCompleted ? 'corrected' : 'recorded',
      prevPairAScore: wasCompleted ? targetMatch.pairAScore : null,
      prevPairBScore: wasCompleted ? targetMatch.pairBScore : null,
      newPairAScore: input.pairAScore,
      newPairBScore: input.pairBScore,
      reason: trimmedReason.length > 0 ? trimmedReason : null,
      createdAt: nowIso
    };

    const updatedRecord: TournamentRecord = {
      ...record,
      rounds: record.rounds.map((r) => (r.id === updatedRound.id ? updatedRound : r)),
      resultAuditLogs: [...record.resultAuditLogs, auditEntry],
      updatedAt: nowIso
    };

    await this.repository.save(updatedRecord);
    return updatedRecord;
  }

  public async simulateCurrentRoundResults(tournamentId: string): Promise<TournamentRecord> {
    let record = await this.requireActiveTournament(tournamentId);
    const round = this.requireCurrentRound(record);
    const pendingMatches = round.matches.filter((m) => m.status === 'pending');

    for (const m of pendingMatches) {
      const rng = new SeededRng(`${record.seed}::ui-sim::R${round.roundNumber}::T${m.tableNumber}`);
      const pairAWins = rng.nextInt(2) === 0;
      const isTimeDraw = rng.nextInt(20) === 0; // 5% chance of draw on time
      const target = record.config.targetScore;

      let pairAScore: number;
      let pairBScore: number;
      let endedBy: MatchEndReason;

      if (isTimeDraw) {
        const tieScore = rng.nextIntRange(Math.floor(target * 0.45), target - 8);
        pairAScore = tieScore;
        pairBScore = tieScore;
        endedBy = 'time_expired';
      } else {
        const winnerScore = target + rng.nextIntRange(0, 34);
        const loserScore = rng.nextIntRange(22, Math.max(25, target - 5));
        pairAScore = pairAWins ? winnerScore : loserScore;
        pairBScore = pairAWins ? loserScore : winnerScore;
        endedBy = 'target_score';
      }

      record = await this.recordMatchResult(record.id, {
        matchId: m.id,
        pairAScore,
        pairBScore,
        endedBy
      });
    }

    return record;
  }

  public async completeRoundAndAdvance(tournamentId: string): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const currentRound = this.requireCurrentRound(record);

    const pendingCount = currentRound.matches.filter((m) => m.status !== 'completed').length;
    if (pendingCount > 0) {
      throw new InvalidTournamentStateError(
        `No se puede cerrar la ronda: aún quedan ${pendingCount} mesas pendientes de resultado.`
      );
    }

    const nowIso = this.nowIso();
    let timer = toTimerState(currentRound, record.config.warningBeforeEndSeconds);
    if (timer.timerStartedAtUtcMs !== null) {
      timer = pauseTimerState(timer, this.nowUtcMs());
    }

    const finalizedRound: PersistedRound = {
      ...applyTimerState(currentRound, timer),
      status: 'completed',
      completedAt: nowIso
    };

    const updatedRounds = record.rounds.map((r) =>
      r.id === finalizedRound.id ? finalizedRound : r
    );

    let nextParticipants = [...record.participants];
    let finalChampion = record.finalChampion;
    const rankingMode = getRankingMode(record);

    const tempRecordForStandings: TournamentRecord = {
      ...record,
      rounds: updatedRounds
    };
    const completedRoundsDomain = toCompletedRounds(tempRecordForStandings);
    const currentStage =
      record.config.format === 'qualifying_elimination' && record.eliminationStages
        ? record.eliminationStages[currentRound.roundNumber - 1] ?? null
        : null;

    if (currentStage !== null) {
      const completedRoundDomain = completedRoundsDomain.find(
        (r) => r.roundNumber === currentRound.roundNumber
      )!;

      const advancement = resolveStageAdvancement({
        stage: currentStage,
        completedRound: completedRoundDomain,
        allParticipants: nextParticipants,
        allCompletedRounds: completedRoundsDomain,
        rankingMode
      });

      finalizedRound.eliminatedParticipantIds = advancement.eliminatedIds;

      if (currentStage.phase === 'final' && completedRoundDomain.matches[0]) {
        finalChampion = resolveFinalChampion({
          finalMatch: completedRoundDomain.matches[0],
          allParticipants: nextParticipants,
          allCompletedRounds: completedRoundsDomain,
          rankingMode
        });
      } else if (advancement.eliminatedIds.length > 0) {
        const elimSet = new Set(advancement.eliminatedIds);
        nextParticipants = nextParticipants.map((p) =>
          elimSet.has(p.id)
            ? { ...p, status: 'eliminated', eliminatedAfterRound: currentRound.roundNumber }
            : p
        );
      }
    }

    const finalUpdatedRounds = updatedRounds.map((r) =>
      r.id === finalizedRound.id ? finalizedRound : r
    );

    const isLastRound =
      currentRound.roundNumber >= record.plannedRounds ||
      (currentStage !== null && currentStage.phase === 'final');

    if (isLastRound) {
      const completedTournament: TournamentRecord = {
        ...record,
        status: 'completed',
        participants: nextParticipants,
        rounds: finalUpdatedRounds,
        finalChampion,
        completedAt: nowIso,
        updatedAt: nowIso
      };
      await this.repository.save(completedTournament);
      return completedTournament;
    }

    // Generate next round dynamically using updated history, standings and active players
    const nextRoundNumber = currentRound.roundNumber + 1;
    const activeRemaining = nextParticipants.filter((p) => p.status === 'active');

    let plannedByesForNext = record.plannedByesByRound[nextRoundNumber] ?? [];
    const activeSet = new Set(activeRemaining.map((p) => p.id));
    const expectedByes = activeRemaining.length % 4;
    if (
      record.config.maxPhysicalTables === null &&
      (plannedByesForNext.length !== expectedByes ||
        plannedByesForNext.some((id) => !activeSet.has(id)))
    ) {
      const hist = buildTournamentHistory(nextParticipants, completedRoundsDomain);
      const replanned = replanRemainingByes({
        activeParticipants: activeRemaining,
        fromRound: nextRoundNumber,
        plannedRounds: record.plannedRounds,
        maxPhysicalTables: record.config.maxPhysicalTables,
        completedByesByPlayer: hist.byesByPlayer,
        lastByeRoundByPlayer: hist.lastByeRoundByPlayer,
        seed: record.seed
      });
      plannedByesForNext = replanned[nextRoundNumber] ?? [];
    }

    const nextStage =
      record.config.format === 'qualifying_elimination' && record.eliminationStages
        ? record.eliminationStages[nextRoundNumber - 1] ?? null
        : null;

    const generatedNext = generateRound({
      roundNumber: nextRoundNumber,
      activeParticipants: activeRemaining,
      plannedByes: plannedByesForNext,
      futurePlannedByesByRound: record.plannedByesByRound,
      history: buildTournamentHistory(nextParticipants, completedRoundsDomain),
      standings: calculateStandings({
        participants: nextParticipants,
        completedRounds: completedRoundsDomain,
        rankingMode
      }),
      config: record.config,
      seed: record.seed
    });

    const nextPersistedRound = this.buildPersistedRound({
      roundNumber: nextRoundNumber,
      phase: nextStage?.phase ?? 'regular',
      stageName: nextStage?.stageName ?? `Ronda ${nextRoundNumber}`,
      durationSeconds: record.config.roundDurationSeconds,
      matches: generatedNext.matches,
      byes: generatedNext.byes,
      metrics: generatedNext.metrics,
      explanations: generatedNext.explanations
    });

    const advancedTournament: TournamentRecord = {
      ...record,
      currentRoundNumber: nextRoundNumber,
      participants: nextParticipants,
      rounds: [...finalUpdatedRounds, nextPersistedRound],
      updatedAt: nowIso
    };

    await this.repository.save(advancedTournament);
    return advancedTournament;
  }

  public async substituteActivePlayer(
    tournamentId: string,
    targetParticipantId: string,
    substituteDisplayName: string
  ): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const updatedParticipants = substituteParticipant({
      participants: record.participants,
      targetParticipantId,
      substituteDisplayName,
      substitutePlayerId: this.generateId('ply')
    });

    const updated: TournamentRecord = {
      ...record,
      participants: updatedParticipants,
      updatedAt: this.nowIso()
    };

    await this.repository.save(updated);
    return updated;
  }

  public async withdrawActivePlayer(
    tournamentId: string,
    participantId: string
  ): Promise<TournamentRecord> {
    const record = await this.requireActiveTournament(tournamentId);
    const currentRound = this.requireCurrentRound(record);
    const target = record.participants.find((p) => p.id === participantId);

    if (!target) {
      throw new DomainValidationError(`Participante "${participantId}" no encontrado.`);
    }
    if (target.status !== 'active') {
      throw new InvalidTournamentStateError(
        `El participante "${target.displayName}" no está activo.`
      );
    }

    const canRegenerateCurrentRound =
      currentRound.status === 'pending' &&
      currentRound.matches.every((m) => m.status === 'pending');

    const withdrawnAfterRound = canRegenerateCurrentRound
      ? currentRound.roundNumber - 1
      : currentRound.roundNumber;

    const nextParticipants: Participant[] = record.participants.map((p) =>
      p.id === participantId
        ? { ...p, status: 'withdrawn', withdrawnAfterRound }
        : p
    );

    const activeRemaining = nextParticipants.filter((p) => p.status === 'active');
    if (activeRemaining.length < 4) {
      throw new DomainValidationError(
        'No pueden quedar menos de 4 participantes activos en el torneo.'
      );
    }

    const completedDomain = toCompletedRounds({
      ...record,
      rounds: canRegenerateCurrentRound
        ? record.rounds.filter((r) => r.roundNumber < currentRound.roundNumber)
        : record.rounds
    });

    const history = buildTournamentHistory(nextParticipants, completedDomain);
    const replanFrom = canRegenerateCurrentRound
      ? currentRound.roundNumber
      : currentRound.roundNumber + 1;

    const replannedFutureByes =
      replanFrom <= record.plannedRounds
        ? replanRemainingByes({
            activeParticipants: activeRemaining,
            fromRound: replanFrom,
            plannedRounds: record.plannedRounds,
            maxPhysicalTables: record.config.maxPhysicalTables,
            completedByesByPlayer: history.byesByPlayer,
            lastByeRoundByPlayer: history.lastByeRoundByPlayer,
            seed: record.seed
          })
        : {};

    const nextPlannedByes: Record<number, string[]> = {
      ...record.plannedByesByRound,
      ...replannedFutureByes
    };

    let nextRounds = [...record.rounds];
    if (canRegenerateCurrentRound) {
      const regenerated = generateRound({
        roundNumber: currentRound.roundNumber,
        activeParticipants: activeRemaining,
        plannedByes: nextPlannedByes[currentRound.roundNumber] ?? [],
        futurePlannedByesByRound: nextPlannedByes,
        history,
        standings: calculateStandings({
          participants: nextParticipants,
          completedRounds: completedDomain,
          rankingMode: getRankingMode(record)
        }),
        config: record.config,
        seed: record.seed
      });

      const rebuiltRound = this.buildPersistedRound({
        roundNumber: currentRound.roundNumber,
        phase: currentRound.phase,
        stageName: currentRound.stageName,
        durationSeconds: currentRound.durationSeconds,
        matches: regenerated.matches,
        byes: regenerated.byes,
        metrics: regenerated.metrics,
        explanations: regenerated.explanations,
        existingId: currentRound.id
      });

      nextRounds = nextRounds.map((r) => (r.id === currentRound.id ? rebuiltRound : r));
    }

    const updated: TournamentRecord = {
      ...record,
      participants: nextParticipants,
      plannedByesByRound: nextPlannedByes,
      rounds: nextRounds,
      updatedAt: this.nowIso()
    };

    await this.repository.save(updated);
    return updated;
  }

  public async getStandings(tournamentId: string): Promise<StandingRow[]> {
    const record = await this.requireTournament(tournamentId);
    return this.computeStandingsForRecord(record);
  }

  public computeStandingsForRecord(record: TournamentRecord): StandingRow[] {
    return calculateStandings({
      participants: record.participants,
      completedRounds: toCompletedRounds(record, { includePartialMatches: true }),
      rankingMode: getRankingMode(record)
    });
  }

  // =========================================================================
  // Helpers privados
  // =========================================================================

  private buildPersistedRound(input: {
    roundNumber: number;
    phase: PersistedRound['phase'];
    stageName: string;
    durationSeconds: number;
    matches: ReadonlyArray<{
      tableNumber: number;
      pairA: [string, string];
      pairB: [string, string];
    }>;
    byes: readonly string[];
    metrics: PersistedRound['metrics'];
    explanations: readonly string[];
    existingId?: string;
  }): PersistedRound {
    return {
      id: input.existingId ?? this.generateId('rnd'),
      roundNumber: input.roundNumber,
      phase: input.phase,
      stageName: input.stageName,
      status: 'pending',
      durationSeconds: input.durationSeconds,
      elapsedBeforeRunMs: 0,
      timerStartedAtUtcMs: null,
      warningFiredAtUtcMs: null,
      expiredFiredAtUtcMs: null,
      matches: input.matches.map((m) => ({
        id: this.generateId('mch'),
        tableNumber: m.tableNumber,
        pairA: m.pairA,
        pairB: m.pairB,
        status: 'pending',
        pairAScore: null,
        pairBScore: null,
        winnerPair: null,
        outcome: null,
        endedBy: null,
        recordedAt: null
      })),
      byes: [...input.byes],
      eliminatedParticipantIds: [],
      metrics: input.metrics,
      explanations: [...input.explanations],
      startedAt: null,
      completedAt: null
    };
  }

  private async saveUpdatedRound(
    record: TournamentRecord,
    updatedRound: PersistedRound
  ): Promise<TournamentRecord> {
    const updated: TournamentRecord = {
      ...record,
      rounds: record.rounds.map((r) => (r.id === updatedRound.id ? updatedRound : r)),
      updatedAt: this.nowIso()
    };
    await this.repository.save(updated);
    return updated;
  }

  private resolveEffectiveConfig(
    config: TournamentConfig,
    activeCount: number,
    strictRequestedFormat: boolean
  ): TournamentConfig {
    if (!strictRequestedFormat && config.format === 'rounds_all_play' && activeCount % 4 !== 0) {
      return {
        ...config,
        format: 'qualifying_elimination'
      };
    }
    return config;
  }

  private async requireTournament(id: string): Promise<TournamentRecord> {
    const record = await this.repository.getById(id);
    if (!record) {
      throw new DomainValidationError(`No se encontró el torneo con ID "${id}".`);
    }
    return record;
  }

  private async requireEditableDraft(id: string): Promise<TournamentRecord> {
    const record = await this.requireTournament(id);
    if (record.status !== 'draft' && record.status !== 'ready') {
      throw new InvalidTournamentStateError(
        'El torneo ya fue iniciado y su inscripción o sorteo inicial no puede modificarse.'
      );
    }
    return record;
  }

  private async requireActiveTournament(id: string): Promise<TournamentRecord> {
    const record = await this.requireTournament(id);
    if (record.status !== 'in_progress') {
      throw new InvalidTournamentStateError(
        'Esta operación solo está disponible en un torneo en curso.'
      );
    }
    return record;
  }

  private requireCurrentRound(record: TournamentRecord): PersistedRound {
    const round =
      record.rounds.find((r) => r.roundNumber === record.currentRoundNumber) ??
      record.rounds[record.rounds.length - 1];
    if (!round) {
      throw new InvalidTournamentStateError('El torneo no tiene una ronda activa.');
    }
    return round;
  }
}
