import { describe, expect, it } from 'vitest';
import {
  calculateStandings,
  computeTournamentStats,
  createSampleParticipants,
  DEFAULT_TOURNAMENT_CONFIG,
  planTournament,
  type CompletedRound
} from '../../src/core/index.js';
import {
  generateFinalReportPdfBytes,
  generateRulesPdfBytes
} from '../../src/infrastructure/pdf-exporter.js';
import type { TournamentRecord } from '../../src/application/ports/tournament-repository.js';

function decodePdfHeader(bytes: Uint8Array): string {
  return new TextDecoder('ascii').decode(bytes.slice(0, 5));
}

describe('Offline PDF Exporter (TDD — Phase 4)', () => {
  it('generates valid binary PDF bytes for the Official Rules document', () => {
    const participants = createSampleParticipants(15);
    const plan = planTournament({
      participants,
      config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'qualifying_elimination' },
      seed: 'pdf-rules-seed'
    });

    const bytes = generateRulesPdfBytes('Copa El Cafetal', plan.rulesDocument, plan.seed);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(decodePdfHeader(bytes)).toBe('%PDF-');
  });

  it('generates valid binary PDF bytes for the Final Tournament Report', () => {
    const participants = createSampleParticipants(8);
    const plan = planTournament({
      participants,
      config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'rounds_all_play' },
      seed: 'pdf-final-seed',
      overrideRounds: 1
    });

    const completedRounds: CompletedRound[] = [
      {
        roundNumber: 1,
        phase: 'regular',
        stageName: 'Ronda 1',
        byes: [],
        metrics: plan.firstRoundPreview.metrics,
        explanations: plan.firstRoundPreview.explanations,
        matches: plan.firstRoundPreview.matches.map((m, idx) => ({
          ...m,
          matchId: `m-${idx + 1}`,
          roundNumber: 1,
          status: 'completed',
          pairAScore: 112,
          pairBScore: 76,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }))
      }
    ];

    const standings = calculateStandings({
      participants,
      completedRounds,
      rankingMode: plan.rankingMode
    });
    const stats = computeTournamentStats(participants, completedRounds, standings);

    const record: TournamentRecord = {
      id: 'trn-pdf',
      name: 'Copa Final PDF',
      status: 'completed',
      seed: plan.seed,
      config: plan.config,
      overrideRounds: 1,
      plannedRounds: 1,
      currentRoundNumber: 1,
      participants,
      plannedByesByRound: plan.plannedByesByRound,
      eliminationStages: null,
      ruleSnapshot: plan.rulesDocument,
      rounds: [
        {
          id: 'r1',
          roundNumber: 1,
          phase: 'regular',
          stageName: 'Ronda 1',
          status: 'completed',
          durationSeconds: 1500,
          elapsedBeforeRunMs: 900_000,
          timerStartedAtUtcMs: null,
          warningFiredAtUtcMs: null,
          expiredFiredAtUtcMs: null,
          matches: completedRounds[0]!.matches.map((m) => ({
            id: m.matchId,
            tableNumber: m.tableNumber,
            pairA: m.pairA,
            pairB: m.pairB,
            status: 'completed',
            pairAScore: m.pairAScore,
            pairBScore: m.pairBScore,
            winnerPair: m.winnerPair,
            outcome: m.outcome,
            endedBy: m.endedBy,
            recordedAt: '2026-11-27T13:00:00.000Z'
          })),
          byes: [],
          eliminatedParticipantIds: [],
          metrics: plan.firstRoundPreview.metrics,
          explanations: plan.firstRoundPreview.explanations,
          startedAt: '2026-11-27T12:30:00.000Z',
          completedAt: '2026-11-27T13:00:00.000Z'
        }
      ],
      resultAuditLogs: [
        {
          id: 'aud-1',
          roundNumber: 1,
          matchId: 'm-1',
          tableNumber: 1,
          action: 'corrected',
          prevPairAScore: 100,
          prevPairBScore: 76,
          newPairAScore: 112,
          newPairBScore: 76,
          reason: 'Ajuste de cierre',
          createdAt: '2026-11-27T12:59:00.000Z'
        }
      ],
      finalChampion: null,
      createdAt: '2026-11-27T12:00:00.000Z',
      startedAt: '2026-11-27T12:30:00.000Z',
      completedAt: '2026-11-27T13:00:00.000Z',
      updatedAt: '2026-11-27T13:00:00.000Z'
    };

    const bytes = generateFinalReportPdfBytes(record, standings, stats);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(decodePdfHeader(bytes)).toBe('%PDF-');
  });
});
