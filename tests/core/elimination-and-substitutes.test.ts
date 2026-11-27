import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  buildTournamentHistory,
  calculateStandings,
  createSampleParticipants,
  generateRound,
  getAvailableTournamentFormats,
  planEliminationStages,
  planTournament,
  simulateTournament,
  substituteParticipant,
  validateTournamentConstraints,
  type CompletedRound
} from '../../src/core/index.js';

describe('Format Eligibility & Qualifying Elimination (ADR-008)', () => {
  it('enables rounds_all_play ONLY for multiples of 4 and always enables qualifying_elimination', () => {
    for (let n = 4; n <= 40; n++) {
      const formats = getAvailableTournamentFormats(n);
      const roundsFormat = formats.find((f) => f.format === 'rounds_all_play')!;
      const elimFormat = formats.find((f) => f.format === 'qualifying_elimination')!;

      expect(roundsFormat.available, `rounds_all_play for N=${n}`).toBe(n % 4 === 0);
      expect(elimFormat.available, `qualifying_elimination for N=${n}`).toBe(true);
    }
  });

  it('rejects planning rounds_all_play when N is not a multiple of 4', () => {
    for (const n of [5, 7, 9, 15, 25, 30]) {
      const participants = createSampleParticipants(n);
      expect(() =>
        planTournament({
          participants,
          config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'rounds_all_play' },
          seed: `reject-${n}`
        })
      ).toThrow(/múltiplos de 4/);
    }
  });

  it('builds exact bracket progression for 6, 15, 25 and 40 players', () => {
    const s6 = planEliminationStages(6, {
      ...DEFAULT_TOURNAMENT_CONFIG,
      format: 'qualifying_elimination'
    });
    expect(s6.map((s) => [s.stageName, s.expectedParticipants, s.byesCount])).toEqual([
      ['Clasificatoria 1', 6, 2],
      ['Clasificatoria 2 (Corte)', 6, 2],
      ['Gran Final', 4, 0]
    ]);

    const s15 = planEliminationStages(15, {
      ...DEFAULT_TOURNAMENT_CONFIG,
      format: 'qualifying_elimination'
    });
    expect(s15.map((s) => [s.stageName, s.expectedParticipants, s.byesCount])).toEqual([
      ['Clasificatoria 1', 15, 3],
      ['Clasificatoria 2 (Corte)', 15, 3],
      ['Semifinal', 8, 0],
      ['Gran Final', 4, 0]
    ]);

    const s25 = planEliminationStages(25, {
      ...DEFAULT_TOURNAMENT_CONFIG,
      format: 'qualifying_elimination'
    });
    expect(s25.map((s) => [s.stageName, s.expectedParticipants, s.byesCount])).toEqual([
      ['Clasificatoria 1', 25, 1],
      ['Clasificatoria 2 (Corte)', 25, 1],
      ['Cuartos de Final', 16, 0],
      ['Semifinal', 8, 0],
      ['Gran Final', 4, 0]
    ]);

    const s40 = planEliminationStages(40, {
      ...DEFAULT_TOURNAMENT_CONFIG,
      format: 'qualifying_elimination'
    });
    expect(s40.map((s) => [s.stageName, s.expectedParticipants, s.byesCount])).toEqual([
      ['Clasificatoria 1', 40, 0],
      ['Clasificatoria 2 (Corte)', 40, 0],
      ['Cuartos de Final', 16, 0],
      ['Semifinal', 8, 0],
      ['Gran Final', 4, 0]
    ]);
  });

  it('guarantees R1 random bye player advances to R2 and plays R2 in qualifying_elimination (N=25)', () => {
    const report = simulateTournament({
      participantCount: 25,
      seed: 'r1-bye-advance-25',
      config: { format: 'qualifying_elimination' }
    });

    const r1 = report.rounds[0]!;
    const r2 = report.rounds[1]!;
    expect(r1.byes.length).toBe(1);
    expect(r1.eliminatedParticipantIds).toEqual([]); // R1 bye player is never eliminated in R1

    const r1ByePlayer = r1.byes[0]!;
    expect(r2.byes).not.toContain(r1ByePlayer); // R1 bye player plays R2
    const r2Players = r2.matches.flatMap((m) => [...m.pairA, ...m.pairB]);
    expect(r2Players).toContain(r1ByePlayer);

    // After R2, 9 eliminated -> 16 remain for Cuartos -> 8 for Semifinal -> 4 for Gran Final
    expect(r2.eliminatedParticipantIds.length).toBe(9);
    expect(report.rounds[2]!.matches.length).toBe(4);
    expect(report.rounds[3]!.matches.length).toBe(2);
    expect(report.rounds[4]!.matches.length).toBe(1);
    expect(report.finalChampion).not.toBeNull();
  });

  it('replaces a player with a substitute mid-tournament keeping 0 byes in rounds_all_play', () => {
    const initial = createSampleParticipants(16);
    const seed = 'substitute-mid-tournament';
    const config = { ...DEFAULT_TOURNAMENT_CONFIG, format: 'rounds_all_play' as const };
    const plan = planTournament({ participants: initial, config, seed });

    const completedRounds: CompletedRound[] = [];

    // Complete rounds 1 & 2 with original 16 players
    for (let r = 1; r <= 2; r++) {
      const gen =
        r === 1
          ? plan.firstRoundPreview
          : generateRound({
              roundNumber: r,
              activeParticipants: initial,
              plannedByes: [],
              history: buildTournamentHistory(initial, completedRounds),
              standings: calculateStandings({
                participants: initial,
                completedRounds,
                rankingMode: 'equal_games'
              }),
              config,
              seed
            });

      completedRounds.push({
        ...gen,
        matches: gen.matches.map((m) => ({
          ...m,
          matchId: `R${r}-T${m.tableNumber}`,
          roundNumber: r,
          status: 'completed',
          pairAScore: 112,
          pairBScore: 76,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }))
      });
    }

    // Substitute P16 with "Carlos (Sustituto)" after Round 2
    const withSub = substituteParticipant({
      participants: initial,
      targetParticipantId: 'P16',
      substituteDisplayName: 'Carlos (Sustituto)',
      substitutePlayerId: 'player-sub-carlos'
    });

    const subEntry = withSub.find((p) => p.id === 'P16')!;
    expect(subEntry.displayName).toBe('Carlos (Sustituto)');
    expect(subEntry.isSubstitute).toBe(true);
    expect(subEntry.substitutedForName).toBe('Jugador 16');

    // Rounds 3..5 continue with 4 exact tables and 0 byes!
    for (let r = 3; r <= plan.selectedRounds; r++) {
      const gen = generateRound({
        roundNumber: r,
        activeParticipants: withSub,
        plannedByes: [],
        history: buildTournamentHistory(withSub, completedRounds),
        standings: calculateStandings({
          participants: withSub,
          completedRounds,
          rankingMode: 'equal_games'
        }),
        config,
        seed
      });

      expect(gen.matches.length).toBe(4);
      expect(gen.byes).toEqual([]);

      completedRounds.push({
        ...gen,
        matches: gen.matches.map((m) => ({
          ...m,
          matchId: `R${r}-T${m.tableNumber}`,
          roundNumber: r,
          status: 'completed',
          pairAScore: 104,
          pairBScore: 88,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }))
      });
    }

    const violations = validateTournamentConstraints({
      participants: withSub,
      rounds: completedRounds,
      config
    });
    expect(violations).toEqual([]);
  });
});
