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
  selectQualifyingRound2Byes,
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

describe('Qualifying Round 2 Byes Favor R1 Winners (ADR-012)', () => {
  it('selectQualifyingRound2Byes picks R1 winners and never R1 losers or R1 byes for N=25 and N=15', () => {
    for (const n of [15, 25]) {
      const participants = createSampleParticipants(n);
      const config = {
        ...DEFAULT_TOURNAMENT_CONFIG,
        format: 'qualifying_elimination' as const
      };
      const plan = planTournament({ participants, config, seed: `adr012-${n}` });
      const r1Gen = plan.firstRoundPreview;
      const r1Completed: CompletedRound = {
        ...r1Gen,
        matches: r1Gen.matches.map((m) => ({
          ...m,
          matchId: `R1-T${m.tableNumber}`,
          roundNumber: 1,
          status: 'completed',
          pairAScore: 100,
          pairBScore: 60,
          winnerPair: 'A',
          outcome: 'pair_a_win',
          endedBy: 'target_score'
        }))
      };
      const r1Standings = calculateStandings({
        participants,
        completedRounds: [r1Completed],
        rankingMode: plan.rankingMode
      });
      const r1Winners = new Set(
        r1Completed.matches.flatMap((m) => [...m.pairA])
      );

      const r2Byes = selectQualifyingRound2Byes({
        activeParticipants: participants,
        r1Standings,
        r1ByeParticipantIds: r1Completed.byes,
        byeCount: n % 4,
        seed: `adr012-${n}`
      });

      expect(r2Byes).toHaveLength(n % 4);
      for (const id of r2Byes) {
        expect(r1Completed.byes).not.toContain(id);
        expect(r1Winners.has(id)).toBe(true);
      }
    }
  });

  it('selectQualifyingRound2Byes handles N=7 (2 R1 winners for 3 R2 byes) without consecutive byes', () => {
    const participants = createSampleParticipants(7);
    const config = {
      ...DEFAULT_TOURNAMENT_CONFIG,
      format: 'qualifying_elimination' as const
    };
    const plan = planTournament({ participants, config, seed: 'adr012-n7' });
    const r1Gen = plan.firstRoundPreview;
    const r1Completed: CompletedRound = {
      ...r1Gen,
      matches: r1Gen.matches.map((m) => ({
        ...m,
        matchId: `R1-T${m.tableNumber}`,
        roundNumber: 1,
        status: 'completed',
        pairAScore: 100,
        pairBScore: 72,
        winnerPair: 'A',
        outcome: 'pair_a_win',
        endedBy: 'target_score'
      }))
    };
    const r1Standings = calculateStandings({
      participants,
      completedRounds: [r1Completed],
      rankingMode: plan.rankingMode
    });
    const r1Winners = r1Completed.matches.flatMap((m) => [...m.pairA]);

    const r2Byes = selectQualifyingRound2Byes({
      activeParticipants: participants,
      r1Standings,
      r1ByeParticipantIds: r1Completed.byes,
      byeCount: 3,
      seed: 'adr012-n7'
    });

    expect(r2Byes).toHaveLength(3);
    expect(new Set(r2Byes).size).toBe(3);
    for (const id of r2Byes) {
      expect(r1Completed.byes).not.toContain(id);
    }
    for (const winnerId of r1Winners) {
      expect(r2Byes).toContain(winnerId);
    }
  });

  it('simulateTournament assigns R2 byes exclusively to R1 winners for N=15 and N=25', () => {
    for (const n of [15, 25]) {
      for (const seed of ['adr012-s1', 'adr012-s2', 'adr012-s7', 'adr012-s19']) {
        const participants = createSampleParticipants(n);
        const report = simulateTournament({
          participantCount: n,
          participants,
          config: {
            format: 'qualifying_elimination'
          },
          seed
        });

        expect(report.constraintViolations).toEqual([]);
        const r1 = report.rounds[0]!;
        const r2 = report.rounds[1]!;
        const r1WinnerIds = new Set(
          r1.matches.flatMap((m) =>
            m.winnerPair === 'A' ? [...m.pairA] : m.winnerPair === 'B' ? [...m.pairB] : []
          )
        );

        expect(r2.byes).toHaveLength(n % 4);
        for (const id of r2.byes) {
          expect(r1.byes).not.toContain(id);
          expect(r1WinnerIds.has(id)).toBe(true);
        }
      }
    }
  });
});
