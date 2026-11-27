import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  SeededRng,
  buildTournamentHistory,
  calculateStandings,
  createSampleParticipants,
  generateRound,
  planTournament,
  replanRemainingByes,
  simulateTournament,
  validateTournamentConstraints,
  type CompletedRound,
  type Participant,
  type SchedulingMode,
  type TournamentFormat
} from '../../src/core/index.js';

const MULTIPLES_OF_4 = [4, 8, 12, 16, 20, 24, 40];
const ALL_REFERENCE_SIZES = [4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 20, 24, 25, 30, 40];

describe('Matchmaking Engine — Property & Invariant Suite', () => {
  it.each(MULTIPLES_OF_4)(
    'rounds_all_play: 0 violations, 0 byes and 0 partner repeats for N=%i (hybrid & fixed)',
    (n) => {
      const modes: SchedulingMode[] = ['hybrid_competitive', 'fixed_schedule'];

      for (const mode of modes) {
        const report = simulateTournament({
          participantCount: n,
          seed: `ref-rounds-${n}-${mode}`,
          config: { format: 'rounds_all_play', schedulingMode: mode }
        });

        expect(report.constraintViolations, `Violations for N=${n} ${mode}`).toEqual([]);
        expect(report.byesPerRound).toBe(0);
        expect(report.equalGamesAchieved).toBe(true);
        expect(report.summary.maxByeSpread).toBe(0);
        expect(report.summary.consecutiveByesCount).toBe(0);
        expect(
          report.summary.repeatedPartners.totalExcessRepeats,
          `Partner repeats for N=${n} ${mode}`
        ).toBe(0);

        const totalGames = report.finalStandings.reduce((acc, s) => acc + s.gamesPlayed, 0);
        expect(totalGames).toBe(4 * report.tablesPerRound * report.plannedRounds);

        const totalWins = report.finalStandings.reduce((acc, s) => acc + s.wins, 0);
        const totalLosses = report.finalStandings.reduce((acc, s) => acc + s.losses, 0);
        expect(totalWins).toBe(totalLosses);

        const totalPF = report.finalStandings.reduce((acc, s) => acc + s.pointsFor, 0);
        const totalPA = report.finalStandings.reduce((acc, s) => acc + s.pointsAgainst, 0);
        expect(totalPF).toBe(totalPA);

        expect(report.rulesSnapshot.parameters.format).toBe('rounds_all_play');
        expect(report.rulesSnapshot.renderedMarkdown).toContain('sin muerte súbita');
      }
    }
  );

  it.each(ALL_REFERENCE_SIZES)(
    'qualifying_elimination: 0 violations, exact multiple-of-4 knockouts & single-match Final for N=%i',
    (n) => {
      const report = simulateTournament({
        participantCount: n,
        seed: `ref-elim-${n}`,
        config: { format: 'qualifying_elimination', schedulingMode: 'hybrid_competitive' }
      });

      expect(report.constraintViolations, `Violations for N=${n}`).toEqual([]);
      expect(report.summary.consecutiveByesCount).toBe(0);
      expect(report.stages).not.toBeNull();

      // Every elimination and final round has 0 byes and exact multiple of 4 players
      for (const r of report.rounds) {
        if (r.phase === 'elimination' || r.phase === 'final') {
          expect(r.byes).toEqual([]);
        }
      }

      // Final stage has 1 table (4 finalists) and produces winning pair + individual champion
      const lastRound = report.rounds[report.rounds.length - 1]!;
      expect(lastRound.phase).toBe('final');
      expect(lastRound.matches.length).toBe(1);
      expect(report.finalChampion).not.toBeNull();
      const champ = report.finalChampion!;
      const pairIds = champ.winningPair.map((p) => p.participantId);
      expect(pairIds).toContain(champ.individualChampion.participantId);

      // Accounting totals always balance globally
      const totalWins = report.finalStandings.reduce((acc, s) => acc + s.wins, 0);
      const totalLosses = report.finalStandings.reduce((acc, s) => acc + s.losses, 0);
      const totalPF = report.finalStandings.reduce((acc, s) => acc + s.pointsFor, 0);
      const totalPA = report.finalStandings.reduce((acc, s) => acc + s.pointsAgainst, 0);
      expect(totalWins).toBe(totalLosses);
      expect(totalPF).toBe(totalPA);

      expect(report.rulesSnapshot.parameters.format).toBe('qualifying_elimination');
      expect(report.rulesSnapshot.renderedMarkdown).toContain('Gran Final');
    }
  );

  it('passes randomized fuzzing across 60 diverse (N, format, seed) combinations', () => {
    const fuzzRng = new SeededRng('fuzz-master-v2-2026');

    for (let trial = 0; trial < 60; trial++) {
      const n = fuzzRng.nextIntRange(4, 40);
      const format: TournamentFormat =
        n % 4 === 0 && fuzzRng.nextInt(2) === 0 ? 'rounds_all_play' : 'qualifying_elimination';
      const mode: SchedulingMode =
        format === 'rounds_all_play' && fuzzRng.nextInt(2) === 0
          ? 'fixed_schedule'
          : 'hybrid_competitive';
      const seed = `fuzz-v2-${trial}-${fuzzRng.nextUint32()}`;

      const report = simulateTournament({
        participantCount: n,
        seed,
        config: { format, schedulingMode: mode }
      });

      expect(
        report.constraintViolations,
        `Fuzz failure trial=${trial} N=${n} format=${format} seed=${seed}`
      ).toEqual([]);
      expect(report.summary.consecutiveByesCount).toBe(0);
    }
  });

  it('is 100% deterministic for the same inputs and seed, and varies across distinct seeds', () => {
    const runA = simulateTournament({
      participantCount: 25,
      seed: 'same-seed-777',
      config: { format: 'qualifying_elimination' }
    });
    const runB = simulateTournament({
      participantCount: 25,
      seed: 'same-seed-777',
      config: { format: 'qualifying_elimination' }
    });
    const runC = simulateTournament({
      participantCount: 25,
      seed: 'other-seed-888',
      config: { format: 'qualifying_elimination' }
    });

    expect({ ...runA, executionTimeMs: 0 }).toEqual({ ...runB, executionTimeMs: 0 });
    expect(runA.rounds[0]!.matches).not.toEqual(runC.rounds[0]!.matches);
  });

  it('supports mid-tournament administrative withdrawal without substitute in rounds_all_play (16 -> 15)', () => {
    const participants: Participant[] = createSampleParticipants(16);
    const seed = 'withdrawal-immutability-seed';
    const plan = planTournament({
      participants,
      config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'rounds_all_play' },
      seed
    });

    const completedRounds: CompletedRound[] = [];

    for (let r = 1; r <= 2; r++) {
      const gen =
        r === 1
          ? plan.firstRoundPreview
          : generateRound({
              roundNumber: r,
              activeParticipants: participants,
              plannedByes: plan.plannedByesByRound[r] ?? [],
              history: buildTournamentHistory(participants, completedRounds),
              standings: calculateStandings({
                participants,
                completedRounds,
                rankingMode: plan.rankingMode
              }),
              config: plan.config,
              seed
            });

      completedRounds.push({
        ...gen,
        matches: gen.matches.map((m) => ({
          ...m,
          matchId: `R${r}-T${m.tableNumber}`,
          roundNumber: r,
          status: 'completed',
          pairAScore: 108,
          pairBScore: 72,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }))
      });
    }

    const rounds1And2Snapshot = JSON.stringify(completedRounds);

    // P16 withdraws after Round 2 without substitute -> 15 active remain (3 tables, 3 byes/round)
    const updatedParticipants: Participant[] = participants.map((p) =>
      p.id === 'P16' ? { ...p, status: 'withdrawn', withdrawnAfterRound: 2 } : p
    );
    const activeRemaining = updatedParticipants.filter((p) => p.status === 'active');
    const historyAfterR2 = buildTournamentHistory(updatedParticipants, completedRounds);

    const replannedByes = replanRemainingByes({
      activeParticipants: activeRemaining,
      fromRound: 3,
      plannedRounds: plan.selectedRounds,
      maxPhysicalTables: null,
      completedByesByPlayer: historyAfterR2.byesByPlayer,
      lastByeRoundByPlayer: historyAfterR2.lastByeRoundByPlayer,
      seed
    });

    for (let r = 3; r <= plan.selectedRounds; r++) {
      const gen = generateRound({
        roundNumber: r,
        activeParticipants: activeRemaining,
        plannedByes: replannedByes[r] ?? [],
        history: buildTournamentHistory(updatedParticipants, completedRounds),
        standings: calculateStandings({
          participants: updatedParticipants,
          completedRounds,
          rankingMode: 'unequal_games'
        }),
        config: plan.config,
        seed
      });

      expect(gen.matches.length).toBe(3);
      expect(gen.byes.length).toBe(3);
      expect(gen.byes).not.toContain('P16');

      completedRounds.push({
        ...gen,
        matches: gen.matches.map((m) => ({
          ...m,
          matchId: `R${r}-T${m.tableNumber}`,
          roundNumber: r,
          status: 'completed',
          pairAScore: 105,
          pairBScore: 81,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }))
      });
    }

    expect(JSON.stringify(completedRounds.slice(0, 2))).toBe(rounds1And2Snapshot);

    const violations = validateTournamentConstraints({
      participants: updatedParticipants,
      rounds: completedRounds,
      config: plan.config,
      allowMidTournamentWithdrawals: true
    });
    expect(violations).toEqual([]);
  });
});
