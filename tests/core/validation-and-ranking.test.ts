import { describe, expect, it } from 'vitest';
import {
  calculateStandings,
  createSampleParticipants,
  validateMatchScore,
  type CompletedRound
} from '../../src/core/index.js';

describe('Score Validation (ADR-002 & ADR-007)', () => {
  it('accepts full uncapped scores above target (e.g. 133 vs 84)', () => {
    const res = validateMatchScore({
      pairAScore: 133,
      pairBScore: 84,
      targetScore: 100,
      endedBy: 'target_score'
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
    expect(res.winnerPair).toBe('A');
    expect(res.outcome).toBe('pair_a_win');
  });

  it('allows draws when time expires (no sudden death, no winner/loser)', () => {
    const res = validateMatchScore({
      pairAScore: 64,
      pairBScore: 64,
      targetScore: 100,
      endedBy: 'time_expired'
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.winnerPair).toBeNull();
    expect(res.outcome).toBe('draw');
  });

  it('rejects draws when endedBy is target_score', () => {
    const res = validateMatchScore({
      pairAScore: 75,
      pairBScore: 75,
      targetScore: 100,
      endedBy: 'target_score'
    });
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('rejects physically impossible scores where both pairs reach targetScore', () => {
    const res = validateMatchScore({
      pairAScore: 105,
      pairBScore: 102,
      targetScore: 100,
      endedBy: 'target_score'
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('físicamente imposible'))).toBe(true);
  });

  it('rejects negative and non-integer scores', () => {
    expect(
      validateMatchScore({
        pairAScore: -5,
        pairBScore: 100,
        targetScore: 100,
        endedBy: 'target_score'
      }).valid
    ).toBe(false);

    expect(
      validateMatchScore({
        pairAScore: 100.5,
        pairBScore: 50,
        targetScore: 100,
        endedBy: 'target_score'
      }).valid
    ).toBe(false);
  });

  it('emits a soft warning without blocking on unusually high scores', () => {
    const res = validateMatchScore({
      pairAScore: 210,
      pairBScore: 40,
      targetScore: 100,
      endedBy: 'target_score'
    });
    expect(res.valid).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('RankingCalculator', () => {
  it('credits pair results individually with exact uncapped points and handles draws', () => {
    const participants = createSampleParticipants(4);
    const rounds: CompletedRound[] = [
      {
        roundNumber: 1,
        byes: [],
        metrics: {
          repeatedPartnersInRound: 0,
          repeatedOpponentsInRound: 0,
          cumulativeMaxPartnerRepeats: 0,
          cumulativeMaxOpponentRepeats: 0,
          cumulativeByeSpread: 0,
          consecutiveByesCount: 0,
          competitiveSpreadAvg: 0,
          allHardConstraintsSatisfied: true
        },
        explanations: [],
        matches: [
          {
            matchId: 'm1',
            roundNumber: 1,
            tableNumber: 1,
            pairA: ['P01', 'P02'],
            pairB: ['P03', 'P04'],
            status: 'completed',
            pairAScore: 133,
            pairBScore: 84,
            winnerPair: 'A',
            outcome: 'pair_a_win',
            endedBy: 'target_score'
          }
        ]
      },
      {
        roundNumber: 2,
        byes: [],
        metrics: {
          repeatedPartnersInRound: 0,
          repeatedOpponentsInRound: 0,
          cumulativeMaxPartnerRepeats: 0,
          cumulativeMaxOpponentRepeats: 0,
          cumulativeByeSpread: 0,
          consecutiveByesCount: 0,
          competitiveSpreadAvg: 0,
          allHardConstraintsSatisfied: true
        },
        explanations: [],
        matches: [
          {
            matchId: 'm2',
            roundNumber: 2,
            tableNumber: 1,
            pairA: ['P01', 'P03'],
            pairB: ['P02', 'P04'],
            status: 'completed',
            pairAScore: 64,
            pairBScore: 64,
            winnerPair: null,
            outcome: 'draw',
            endedBy: 'time_expired'
          }
        ]
      }
    ];

    const standings = calculateStandings({
      participants,
      completedRounds: rounds,
      rankingMode: 'equal_games'
    });

    const p1 = standings.find((s) => s.participantId === 'P01')!;
    const p3 = standings.find((s) => s.participantId === 'P03')!;

    expect(p1.gamesPlayed).toBe(2);
    expect(p1.wins).toBe(1);
    expect(p1.draws).toBe(1);
    expect(p1.losses).toBe(0);
    expect(p1.matchPoints).toBe(1.5);
    expect(p1.pointsFor).toBe(197);
    expect(p1.pointsAgainst).toBe(148);
    expect(p1.pointDiff).toBe(49);
    expect(p1.rank).toBe(1);
    expect(p1.isTied).toBe(true); // P01 and P02 have identical stats

    expect(p3.wins).toBe(0);
    expect(p3.draws).toBe(1);
    expect(p3.losses).toBe(1);
    expect(p3.matchPoints).toBe(0.5);
    expect(p3.pointDiff).toBe(-49);
  });

  it('prevents the undefeated paradox in unequal_games (5-0 ranks ahead of 4-0 + bye)', () => {
    const participants = createSampleParticipants(5);

    const makeMatch = (
      roundNumber: number,
      pairA: [string, string],
      pairB: [string, string],
      pairAScore: number,
      pairBScore: number
    ): CompletedRound => {
      const playing = new Set([...pairA, ...pairB]);
      const bye = participants.find((p) => !playing.has(p.id))!.id;
      return {
        roundNumber,
        byes: [bye],
        explanations: [],
        metrics: {
          repeatedPartnersInRound: 0,
          repeatedOpponentsInRound: 0,
          cumulativeMaxPartnerRepeats: 0,
          cumulativeMaxOpponentRepeats: 0,
          cumulativeByeSpread: 1,
          consecutiveByesCount: 0,
          competitiveSpreadAvg: 0,
          allHardConstraintsSatisfied: true
        },
        matches: [
          {
            matchId: `r${roundNumber}`,
            roundNumber,
            tableNumber: 1,
            pairA,
            pairB,
            status: 'completed',
            pairAScore,
            pairBScore,
            winnerPair: 'A',
            outcome: 'pair_a_win',
            endedBy: 'target_score'
          }
        ]
      };
    };

    // P01 plays 5 games and wins all 5 (+20 each = +100).
    // P02 rests once, plays 4 games and wins all 4 (+70 each = +280 avg diff +70 > +20).
    const rounds: CompletedRound[] = [
      makeMatch(1, ['P01', 'P03'], ['P04', 'P05'], 100, 80), // P02 byes
      makeMatch(2, ['P01', 'P02'], ['P03', 'P04'], 110, 40), // P05 byes
      makeMatch(3, ['P01', 'P02'], ['P03', 'P05'], 110, 40), // P04 byes
      makeMatch(4, ['P01', 'P02'], ['P04', 'P05'], 110, 40), // P03 byes
      makeMatch(5, ['P01', 'P02'], ['P03', 'P04'], 110, 40)  // P05 byes
    ];

    const standings = calculateStandings({
      participants,
      completedRounds: rounds,
      rankingMode: 'unequal_games'
    });

    // P01 (5-0, 100%) MUST beat P02 (4-0 + 1 bye, 100%)
    expect(standings[0]!.participantId).toBe('P01');
    expect(standings[0]!.wins).toBe(5);
    expect(standings[1]!.participantId).toBe('P02');
    expect(standings[1]!.wins).toBe(4);
  });

  it('recalculates cleanly without duplicate accumulation after administrative correction', () => {
    const participants = createSampleParticipants(4);
    const baseRound: CompletedRound = {
      roundNumber: 1,
      byes: [],
      explanations: [],
      metrics: {
        repeatedPartnersInRound: 0,
        repeatedOpponentsInRound: 0,
        cumulativeMaxPartnerRepeats: 0,
        cumulativeMaxOpponentRepeats: 0,
        cumulativeByeSpread: 0,
        consecutiveByesCount: 0,
        competitiveSpreadAvg: 0,
        allHardConstraintsSatisfied: true
      },
      matches: [
        {
          matchId: 'm1',
          roundNumber: 1,
          tableNumber: 1,
          pairA: ['P01', 'P02'],
          pairB: ['P03', 'P04'],
          status: 'completed',
          pairAScore: 110,
          pairBScore: 60,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }
      ]
    };

    const before = calculateStandings({
      participants,
      completedRounds: [baseRound],
      rankingMode: 'equal_games'
    });
    expect(before[0]!.participantId).toBe('P01');

    // Admin corrects the result: Pair B actually won 105-95
    const correctedRound: CompletedRound = {
      ...baseRound,
      matches: [
        {
          ...baseRound.matches[0]!,
          pairAScore: 95,
          pairBScore: 105,
          winnerPair: 'B',
          outcome: 'pair_b_win',
          endedBy: 'admin_override'
        }
      ]
    };

    const after = calculateStandings({
      participants,
      completedRounds: [correctedRound],
      rankingMode: 'equal_games'
    });
    expect(after[0]!.participantId).toBe('P03');
    expect(after[0]!.gamesPlayed).toBe(1);
    expect(after[0]!.wins).toBe(1);
    expect(after[0]!.pointsFor).toBe(105);
    expect(after.find((s) => s.participantId === 'P01')!.wins).toBe(0);
    expect(after.find((s) => s.participantId === 'P01')!.gamesPlayed).toBe(1);
  });
});
