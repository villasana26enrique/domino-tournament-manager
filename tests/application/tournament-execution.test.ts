import { beforeEach, describe, expect, it } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';

describe('TournamentService Execution (TDD — Timer, Results, Audit, Advancement & Contingencies)', () => {
  let repo: InMemoryTournamentRepository;
  let service: TournamentService;
  let nowMs: number;

  beforeEach(() => {
    let seq = 1;
    nowMs = 1_700_000_000_000;
    repo = new InMemoryTournamentRepository();
    service = new TournamentService({
      repository: repo,
      generateId: (prefix) => `${prefix}-${seq++}`,
      nowIso: () => new Date(nowMs).toISOString(),
      nowUtcMs: () => nowMs
    });
  });

  async function startTournamentWithPlayers(
    count: number,
    format: 'rounds_all_play' | 'qualifying_elimination',
    overrideRounds?: number
  ) {
    const draft = await service.createDraft(`Torneo ${count}`);
    const names = Array.from({ length: count }, (_, i) => `Jugador ${i + 1}`).join('\n');
    await service.addParticipantsBulk(draft.id, names);
    await service.updateConfig(draft.id, { format }, overrideRounds ?? null);
    return service.confirmAndStartTournament(draft.id);
  }

  it('controls persistent round timer transitions without duplicating alarms', async () => {
    const started = await startTournamentWithPlayers(8, 'rounds_all_play', 3);

    const running = await service.startRoundTimer(started.id);
    expect(running.rounds[0]!.status).toBe('in_progress');
    expect(running.rounds[0]!.timerStartedAtUtcMs).toBe(nowMs);
    expect(running.rounds[0]!.startedAt).not.toBeNull();

    // Advance 10 min and pause
    nowMs += 10 * 60_000;
    const paused = await service.pauseRoundTimer(started.id);
    expect(paused.rounds[0]!.status).toBe('paused');
    expect(paused.rounds[0]!.elapsedBeforeRunMs).toBe(10 * 60_000);
    expect(paused.rounds[0]!.timerStartedAtUtcMs).toBeNull();

    // Resume and jump to 21 min elapsed (4 min left -> warning zone)
    nowMs += 5 * 60_000;
    await service.startRoundTimer(started.id);
    nowMs += 11 * 60_000;
    const syncedWarn = await service.syncRoundTimer(started.id);
    expect(syncedWarn.round.warningFiredAtUtcMs).toBe(nowMs);
    expect(syncedWarn.warningTriggered).toBe(true);
    expect(syncedWarn.expiredTriggered).toBe(false);

    // Sync again -> warning MUST NOT re-trigger
    nowMs += 60_000;
    const syncedAgain = await service.syncRoundTimer(started.id);
    expect(syncedAgain.warningTriggered).toBe(false);

    // Force expire manually or by time
    const expired = await service.expireRoundTimerNow(started.id);
    expect(expired.rounds[0]!.status).toBe('time_expired');
    expect(expired.rounds[0]!.expiredFiredAtUtcMs).not.toBeNull();
  });

  it('records results (>100 and time draws), enforces audit logs on corrections, and updates standings cleanly', async () => {
    const started = await startTournamentWithPlayers(8, 'rounds_all_play', 3);
    const m1 = started.rounds[0]!.matches[0]!;
    const m2 = started.rounds[0]!.matches[1]!;

    // Reject impossible score (>= target both) & draw with target_score
    await expect(
      service.recordMatchResult(started.id, {
        matchId: m1.id,
        pairAScore: 105,
        pairBScore: 102,
        endedBy: 'target_score'
      })
    ).rejects.toThrow(/físicamente imposible/i);

    await expect(
      service.recordMatchResult(started.id, {
        matchId: m1.id,
        pairAScore: 70,
        pairBScore: 70,
        endedBy: 'target_score'
      })
    ).rejects.toThrow(/empatada/i);

    // Record >100 uncapped score on Mesa 1
    const afterM1 = await service.recordMatchResult(started.id, {
      matchId: m1.id,
      pairAScore: 133,
      pairBScore: 84,
      endedBy: 'target_score'
    });
    expect(afterM1.resultAuditLogs).toHaveLength(1);
    expect(afterM1.resultAuditLogs[0]!.action).toBe('recorded');
    expect(afterM1.rounds[0]!.status).toBe('recording_results');

    // Record time-expired draw on Mesa 2 (no winner, no loser)
    const afterM2 = await service.recordMatchResult(started.id, {
      matchId: m2.id,
      pairAScore: 64,
      pairBScore: 64,
      endedBy: 'time_expired'
    });
    const savedM2 = afterM2.rounds[0]!.matches[1]!;
    expect(savedM2.outcome).toBe('draw');
    expect(savedM2.winnerPair).toBeNull();

    // Correct Mesa 1 without reason -> MUST fail
    await expect(
      service.recordMatchResult(started.id, {
        matchId: m1.id,
        pairAScore: 95,
        pairBScore: 104,
        endedBy: 'admin_override',
        reason: '   '
      })
    ).rejects.toThrow(/motivo/i);

    // Correct Mesa 1 with valid reason -> logs prev/new scores and recalculates standings without duplication
    const corrected = await service.recordMatchResult(started.id, {
      matchId: m1.id,
      pairAScore: 95,
      pairBScore: 104,
      endedBy: 'admin_override',
      reason: 'Error al transcribir hoja de Mesa 1'
    });
    expect(corrected.resultAuditLogs).toHaveLength(3);
    const corrLog = corrected.resultAuditLogs[2]!;
    expect(corrLog.action).toBe('corrected');
    expect(corrLog.prevPairAScore).toBe(133);
    expect(corrLog.prevPairBScore).toBe(84);
    expect(corrLog.newPairAScore).toBe(95);
    expect(corrLog.newPairBScore).toBe(104);

    const standings = await service.getStandings(started.id);
    const totalGames = standings.reduce((acc, s) => acc + s.gamesPlayed, 0);
    expect(totalGames).toBe(8); // Still 1 game per player, never duplicated!
    const m1PairBMember = standings.find((s) => s.participantId === m1.pairB[0])!;
    expect(m1PairBMember.wins).toBe(1);
    expect(m1PairBMember.pointsFor).toBe(104);
  });

  it('completes rounds_all_play (8 players, 3 rounds) sequentially to completed status', async () => {
    const started = await startTournamentWithPlayers(8, 'rounds_all_play', 3);

    // Cannot advance with pending matches
    await expect(service.completeRoundAndAdvance(started.id)).rejects.toThrow(/mesas pendientes/i);

    // R1 -> R2 -> R3 -> Completed
    await service.simulateCurrentRoundResults(started.id);
    const afterR1 = await service.completeRoundAndAdvance(started.id);
    expect(afterR1.currentRoundNumber).toBe(2);
    expect(afterR1.rounds).toHaveLength(2);
    expect(afterR1.rounds[0]!.status).toBe('completed');
    expect(afterR1.rounds[1]!.status).toBe('pending');

    await service.simulateCurrentRoundResults(started.id);
    const afterR2 = await service.completeRoundAndAdvance(started.id);
    expect(afterR2.currentRoundNumber).toBe(3);
    expect(afterR2.rounds).toHaveLength(3);

    await service.simulateCurrentRoundResults(started.id);
    const finished = await service.completeRoundAndAdvance(started.id);
    expect(finished.status).toBe('completed');
    expect(finished.completedAt).not.toBeNull();
    expect(finished.rounds[2]!.status).toBe('completed');
  });

  it('executes full qualifying_elimination tournament (15 players -> Semifinal 8 -> Gran Final 4 -> Champion)', async () => {
    const started = await startTournamentWithPlayers(15, 'qualifying_elimination');
    expect(started.plannedRounds).toBe(4); // Clasif 1, Clasif 2, Semifinal (8), Gran Final (4)

    // R1 (Clasif 1): 15 players, 3 tables, 3 random byes
    expect(started.rounds[0]!.byes).toHaveLength(3);
    const r1Byes = [...started.rounds[0]!.byes];
    await service.simulateCurrentRoundResults(started.id);
    const afterR1 = await service.completeRoundAndAdvance(started.id);
    expect(afterR1.rounds[0]!.eliminatedParticipantIds).toEqual([]);

    // R2 (Clasif 2): R1 bye players MUST play in R2, and R2 byes go to R1 winners (ADR-012)
    const r1WinnerIds = new Set(
      afterR1.rounds[0]!.matches.flatMap((m) =>
        m.winnerPair === 'A' ? [...m.pairA] : m.winnerPair === 'B' ? [...m.pairB] : []
      )
    );
    for (const byeId of r1Byes) {
      expect(afterR1.rounds[1]!.byes).not.toContain(byeId);
    }
    for (const r2ByeId of afterR1.rounds[1]!.byes) {
      expect(r1WinnerIds.has(r2ByeId)).toBe(true);
    }
    await service.simulateCurrentRoundResults(started.id);
    const afterR2 = await service.completeRoundAndAdvance(started.id);

    // After R2 cut: 7 eliminated, 8 remain for Semifinal (2 tables, 0 byes)
    expect(afterR2.rounds[1]!.eliminatedParticipantIds).toHaveLength(7);
    expect(afterR2.rounds[2]!.stageName).toBe('Semifinal');
    expect(afterR2.rounds[2]!.matches).toHaveLength(2);
    expect(afterR2.rounds[2]!.byes).toEqual([]);

    // R3 (Semifinal) -> Gran Final (4 finalists, 1 table, 0 byes)
    await service.simulateCurrentRoundResults(started.id);
    const afterR3 = await service.completeRoundAndAdvance(started.id);
    expect(afterR3.rounds[2]!.eliminatedParticipantIds).toHaveLength(4);
    expect(afterR3.rounds[3]!.stageName).toBe('Gran Final');
    expect(afterR3.rounds[3]!.matches).toHaveLength(1);
    expect(afterR3.rounds[3]!.byes).toEqual([]);

    // R4 (Gran Final) -> Completed with Winning Pair & Individual Champion
    await service.simulateCurrentRoundResults(started.id);
    const finished = await service.completeRoundAndAdvance(started.id);
    expect(finished.status).toBe('completed');
    expect(finished.finalChampion).not.toBeNull();
    expect(finished.finalChampion!.winningPair).toHaveLength(2);
    const winningIds = finished.finalChampion!.winningPair.map((p) => p.participantId);
    expect(winningIds).toContain(finished.finalChampion!.individualChampion.participantId);
  });

  it('supports mid-tournament substitute (keeping 0 byes) and withdrawal without substitute', async () => {
    // Case A: Substitute in rounds_all_play (16 players)
    const tSub = await startTournamentWithPlayers(16, 'rounds_all_play', 4);
    await service.simulateCurrentRoundResults(tSub.id);
    await service.completeRoundAndAdvance(tSub.id);

    const substituted = await service.substituteActivePlayer(
      tSub.id,
      tSub.participants[15]!.id,
      'Carlos Sustituto'
    );
    expect(substituted.participants[15]!.displayName).toBe('Carlos Sustituto');
    expect(substituted.participants[15]!.isSubstitute).toBe(true);
    expect(substituted.rounds[1]!.matches).toHaveLength(4);
    expect(substituted.rounds[1]!.byes).toEqual([]);

    // Case B: Withdrawal without substitute before starting next round
    const tWith = await startTournamentWithPlayers(12, 'rounds_all_play', 4);
    await service.simulateCurrentRoundResults(tWith.id);
    const afterR1 = await service.completeRoundAndAdvance(tWith.id);
    expect(afterR1.rounds[1]!.matches).toHaveLength(3); // R2 was generated with 12

    // Withdraw player #12 while R2 is still pending -> R2 regenerates for 11 active (2 tables, 3 byes)
    const afterWithdraw = await service.withdrawActivePlayer(
      tWith.id,
      tWith.participants[11]!.id
    );
    expect(afterWithdraw.participants[11]!.status).toBe('withdrawn');
    expect(afterWithdraw.rounds[1]!.matches).toHaveLength(2);
    expect(afterWithdraw.rounds[1]!.byes).toHaveLength(3);
    expect(afterWithdraw.rounds[0]!.matches).toHaveLength(3); // R1 untouched!
  });
});
