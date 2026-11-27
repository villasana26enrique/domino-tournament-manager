import { describe, expect, it } from 'vitest';
import {
  calculateStandings,
  computeTournamentStats,
  createSampleParticipants,
  type CompletedRound,
  type FairnessMetrics
} from '../../src/core/index.js';

const ZERO_METRICS: FairnessMetrics = {
  repeatedPartnersInRound: 0,
  repeatedOpponentsInRound: 0,
  cumulativeMaxPartnerRepeats: 0,
  cumulativeMaxOpponentRepeats: 0,
  cumulativeByeSpread: 0,
  consecutiveByesCount: 0,
  competitiveSpreadAvg: 0,
  allHardConstraintsSatisfied: true
};

describe('computeTournamentStats (TDD — Phase 4)', () => {
  it('computes accurate tournament statistics including highest score, largest margin, draws and leaders', () => {
    const participants = createSampleParticipants(8);
    const rounds: CompletedRound[] = [
      {
        roundNumber: 1,
        phase: 'regular',
        stageName: 'Ronda 1',
        byes: [],
        metrics: ZERO_METRICS,
        explanations: [],
        matches: [
          {
            matchId: 'm1',
            roundNumber: 1,
            tableNumber: 1,
            pairA: ['P01', 'P02'],
            pairB: ['P03', 'P04'],
            status: 'completed',
            pairAScore: 138,
            pairBScore: 62,
            winnerPair: 'A',
            outcome: 'pair_a_win',
            endedBy: 'target_score'
          },
          {
            matchId: 'm2',
            roundNumber: 1,
            tableNumber: 2,
            pairA: ['P05', 'P06'],
            pairB: ['P07', 'P08'],
            status: 'completed',
            pairAScore: 70,
            pairBScore: 70,
            winnerPair: null,
            outcome: 'draw',
            endedBy: 'time_expired'
          }
        ]
      },
      {
        roundNumber: 2,
        phase: 'regular',
        stageName: 'Ronda 2',
        byes: [],
        metrics: { ...ZERO_METRICS, repeatedPartnersInRound: 1 },
        explanations: [],
        matches: [
          {
            matchId: 'm3',
            roundNumber: 2,
            tableNumber: 1,
            pairA: ['P01', 'P03'],
            pairB: ['P05', 'P07'],
            status: 'completed',
            pairAScore: 105,
            pairBScore: 95,
            winnerPair: 'A',
            outcome: 'pair_a_win',
            endedBy: 'target_score'
          },
          {
            matchId: 'm4',
            roundNumber: 2,
            tableNumber: 2,
            pairA: ['P02', 'P04'],
            pairB: ['P06', 'P08'],
            status: 'completed',
            pairAScore: 112,
            pairBScore: 20,
            winnerPair: 'A',
            outcome: 'pair_a_win',
            endedBy: 'target_score'
          }
        ]
      }
    ];

    const standings = calculateStandings({
      participants,
      completedRounds: rounds,
      rankingMode: 'equal_games'
    });

    const stats = computeTournamentStats(participants, rounds, standings);

    expect(stats.totalMatches).toBe(4);
    expect(stats.drawsCount).toBe(1);
    expect(stats.totalPointsScored).toBe(138 + 62 + 70 + 70 + 105 + 95 + 112 + 20);
    expect(stats.highestMatchScore).toEqual({
      roundNumber: 1,
      tableNumber: 1,
      score: 138,
      loserScore: 62
    });
    expect(stats.largestVictoryMargin).toEqual({
      roundNumber: 2,
      tableNumber: 2,
      margin: 92,
      winnerScore: 112,
      loserScore: 20
    });
    expect(stats.repeatedPartnersCount).toBe(0); // Actual partners in rounds are all distinct
    expect(stats.topScorer?.participantId).toBe('P02'); // 138 + 112 = 250 PF
    expect(stats.bestDifferential?.participantId).toBe('P02'); // +76 + 92 = +168
  });
});
