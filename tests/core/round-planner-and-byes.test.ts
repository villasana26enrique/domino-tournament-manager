import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  computeParticipationMath,
  createSampleParticipants,
  planRoundCount,
  replanRemainingByes,
  scheduleByes
} from '../../src/core/index.js';

describe('RoundCountPlanner & Participation Math', () => {
  it('computes exact tables, actives, byes and minEqualRounds for reference sizes', () => {
    const cases: Array<[number, number, number, number]> = [
      // [N, expectedTables, expectedByes, expectedMinEqualRounds]
      [4, 1, 0, 1],
      [5, 1, 1, 5],
      [6, 1, 2, 3],
      [7, 1, 3, 7],
      [8, 2, 0, 1],
      [9, 2, 1, 9],
      [10, 2, 2, 5],
      [12, 3, 0, 1],
      [14, 3, 2, 7],
      [15, 3, 3, 5],
      [16, 4, 0, 1],
      [20, 5, 0, 1],
      [24, 6, 0, 1],
      [25, 6, 1, 25],
      [30, 7, 2, 15],
      [40, 10, 0, 1]
    ];

    for (const [n, tables, byes, minEq] of cases) {
      const m = computeParticipationMath(n, null);
      expect(m.tablesPerRound, `tables for N=${n}`).toBe(tables);
      expect(m.activePerRound, `actives for N=${n}`).toBe(tables * 4);
      expect(m.byesPerRound, `byes for N=${n}`).toBe(byes);
      expect(m.minEqualRounds, `minEqualRounds for N=${n}`).toBe(minEq);
      expect(m.consecutiveByesUnavoidable, `consecutiveByesUnavoidable for N=${n}`).toBe(false);
    }
  });

  it('recommends mathematically coherent round counts for short social tournaments', () => {
    // N=4 -> 3 rounds (complete partner rotation without forced repeats)
    const p4 = planRoundCount(4, DEFAULT_TOURNAMENT_CONFIG);
    expect(p4.recommendedRounds).toBe(3);
    expect(p4.equalGamesAchieved).toBe(true);
    expect(p4.rankingMode).toBe('equal_games');

    // N=5 -> 5 rounds (exact equality: 4 games + 1 bye each)
    const p5 = planRoundCount(5, DEFAULT_TOURNAMENT_CONFIG);
    expect(p5.recommendedRounds).toBe(5);
    expect(p5.equalGamesAchieved).toBe(true);
    expect(p5.minGamesPerPlayer).toBe(4);
    expect(p5.maxGamesPerPlayer).toBe(4);

    // N=6 -> 6 rounds (exact equality: 4 games + 2 byes each)
    const p6 = planRoundCount(6, DEFAULT_TOURNAMENT_CONFIG);
    expect(p6.recommendedRounds).toBe(6);
    expect(p6.equalGamesAchieved).toBe(true);
    expect(p6.minGamesPerPlayer).toBe(4);

    // N=7 -> 7 rounds (exact equality: 4 games + 3 byes each)
    const p7 = planRoundCount(7, DEFAULT_TOURNAMENT_CONFIG);
    expect(p7.recommendedRounds).toBe(7);
    expect(p7.equalGamesAchieved).toBe(true);
    expect(p7.minGamesPerPlayer).toBe(4);

    // N=10 -> 5 rounds (exact equality: 4 games + 1 bye each)
    const p10 = planRoundCount(10, DEFAULT_TOURNAMENT_CONFIG);
    expect(p10.recommendedRounds).toBe(5);
    expect(p10.equalGamesAchieved).toBe(true);

    // N=15 -> 5 rounds (exact equality: 4 games + 1 bye each)
    const p15 = planRoundCount(15, DEFAULT_TOURNAMENT_CONFIG);
    expect(p15.recommendedRounds).toBe(5);
    expect(p15.equalGamesAchieved).toBe(true);
    expect(p15.minByesPerPlayer).toBe(1);
    expect(p15.maxByesPerPlayer).toBe(1);

    // N=25 -> short tournament (5 rounds), unequal by at most 1 game, friendly warning
    const p25 = planRoundCount(25, DEFAULT_TOURNAMENT_CONFIG);
    expect(p25.recommendedRounds).toBe(5);
    expect(p25.equalGamesAchieved).toBe(false);
    expect(p25.maxGamesPerPlayer - p25.minGamesPerPlayer).toBe(1);
    expect(p25.rankingMode).toBe('unequal_games');
    expect(p25.warnings.some((w) => w.includes('24 jugadores'))).toBe(true);

    // N=30 -> short tournament (5 rounds), unequal by at most 1 game
    const p30 = planRoundCount(30, DEFAULT_TOURNAMENT_CONFIG);
    expect(p30.recommendedRounds).toBe(5);
    expect(p30.equalGamesAchieved).toBe(false);
    expect(p30.maxGamesPerPlayer - p30.minGamesPerPlayer).toBe(1);
    expect(p30.rankingMode).toBe('unequal_games');
  });

  it('supports strict_equality round planning mode when explicitly selected', () => {
    const p9Strict = planRoundCount(9, {
      ...DEFAULT_TOURNAMENT_CONFIG,
      roundPlanningMode: 'strict_equality'
    });
    expect(p9Strict.recommendedRounds).toBe(9);
    expect(p9Strict.equalGamesAchieved).toBe(true);
    expect(p9Strict.minGamesPerPlayer).toBe(8);
    expect(p9Strict.maxGamesPerPlayer).toBe(8);
  });

  it('handles physical table cap and detects unavoidable consecutive byes', () => {
    // 10 players with only 1 physical table: 4 active, 6 byes -> consecutive byes unavoidable
    const plan = planRoundCount(10, {
      ...DEFAULT_TOURNAMENT_CONFIG,
      maxPhysicalTables: 1
    });
    expect(plan.math.tablesPerRound).toBe(1);
    expect(plan.math.byesPerRound).toBe(6);
    expect(plan.math.consecutiveByesUnavoidable).toBe(true);
    expect(plan.warnings.some((w) => w.includes('inevitables'))).toBe(true);
  });

  it('rejects fewer than 4 participants', () => {
    expect(() => computeParticipationMath(3, null)).toThrow();
    expect(() => planRoundCount(2, DEFAULT_TOURNAMENT_CONFIG)).toThrow();
  });
});

describe('ByeScheduler', () => {
  it('guarantees spread <= 1 and zero consecutive byes for all N in [4..40]', () => {
    for (let n = 4; n <= 40; n++) {
      const participants = createSampleParticipants(n);
      const rounds = 7;
      const byesByRound = scheduleByes(participants, rounds, null, `bye-seed-${n}`);

      const counts = new Map<string, number>(participants.map((p) => [p.id, 0]));
      let prev = new Set<string>();

      for (let r = 1; r <= rounds; r++) {
        const current = byesByRound[r]!;
        expect(current.length).toBe(n % 4);
        for (const id of current) {
          expect(prev.has(id), `Consecutive bye for N=${n} R=${r} player=${id}`).toBe(false);
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        prev = new Set(current);
      }

      const values = [...counts.values()];
      expect(Math.max(...values) - Math.min(...values), `Spread for N=${n}`).toBeLessThanOrEqual(1);
    }
  });

  it('replans remaining byes fairly after a mid-tournament withdrawal', () => {
    const participants = createSampleParticipants(15);
    const remaining = participants.slice(0, 14); // P15 withdrew after round 2

    const completedByes = new Map<string, number>([
      ['P01', 1],
      ['P02', 1],
      ['P03', 1],
      ['P04', 1],
      ['P05', 1],
      ['P06', 1]
    ]);
    const lastBye = new Map<string, number>([
      ['P04', 2],
      ['P05', 2],
      ['P06', 2]
    ]);

    const replanned = replanRemainingByes({
      activeParticipants: remaining,
      fromRound: 3,
      plannedRounds: 5,
      maxPhysicalTables: null,
      completedByesByPlayer: completedByes,
      lastByeRoundByPlayer: lastBye,
      seed: 'withdraw-test'
    });

    // 14 active -> 2 byes per round for rounds 3, 4, 5
    for (const r of [3, 4, 5]) {
      expect(replanned[r]?.length).toBe(2);
    }
    // Nobody who rested in Round 2 (P04, P05, P06) should rest consecutively in Round 3
    for (const id of replanned[3]!) {
      expect(['P04', 'P05', 'P06']).not.toContain(id);
    }
  });
});
