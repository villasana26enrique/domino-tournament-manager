import {
  DEFAULT_TOURNAMENT_CONFIG,
  type CompletedRound,
  type FinalChampionSummary,
  type MatchEndReason,
  type Participant,
  type RecordedMatch,
  type SimulationReport,
  type SimulationRoundReport,
  type TournamentConfig,
  type TournamentFormat
} from '../domain/types.js';
import { validateMatchScore } from '../domain/validation.js';
import { SeededRng } from '../prng/seeded-rng.js';
import { validateTournamentConstraints } from '../algorithms/constraint-validator.js';
import {
  resolveFinalChampion,
  resolveStageAdvancement
} from '../algorithms/elimination-planner.js';
import { summarizeTournamentFairness } from '../algorithms/fairness-evaluator.js';
import { buildTournamentHistory } from '../algorithms/history.js';
import { generateRound } from '../algorithms/matchmaking-engine.js';
import { calculateStandings } from '../algorithms/ranking-calculator.js';
import { planTournament } from '../algorithms/tournament-planner.js';

export function createSampleParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, idx) => {
    const num = idx + 1;
    const padded = String(num).padStart(2, '0');
    return {
      id: `P${padded}`,
      playerId: `player-${padded}`,
      number: num,
      displayName: `Jugador ${num}`,
      status: 'active',
      withdrawnAfterRound: null,
      eliminatedAfterRound: null
    };
  });
}

function simulateRealisticMatchScore(
  rng: SeededRng,
  targetScore: number,
  pairASkill: number,
  pairBSkill: number
): {
  pairAScore: number;
  pairBScore: number;
  endedBy: MatchEndReason;
} {
  const modeRoll = rng.nextInt(100);
  const winProbA = 0.5 + (pairASkill - pairBSkill) * 0.25;
  const pairAWins = rng.nextFloat() < Math.min(0.85, Math.max(0.15, winProbA));

  if (modeRoll < 78) {
    const winnerScore = targetScore + rng.nextIntRange(0, 42);
    const loserScore = rng.nextIntRange(18, Math.max(20, targetScore - 4));
    return {
      pairAScore: pairAWins ? winnerScore : loserScore,
      pairBScore: pairAWins ? loserScore : winnerScore,
      endedBy: 'target_score'
    };
  }

  if (modeRoll < 97) {
    const winnerScore = rng.nextIntRange(Math.floor(targetScore * 0.45), targetScore - 1);
    const loserScore = rng.nextIntRange(15, winnerScore - 1);
    return {
      pairAScore: pairAWins ? winnerScore : loserScore,
      pairBScore: pairAWins ? loserScore : winnerScore,
      endedBy: 'time_expired'
    };
  }

  const drawScore = rng.nextIntRange(Math.floor(targetScore * 0.4), targetScore - 5);
  return {
    pairAScore: drawScore,
    pairBScore: drawScore,
    endedBy: 'time_expired'
  };
}

/**
 * Runs a full deterministic headless simulation of a tournament in either format:
 * - rounds_all_play (multiple of 4 only, 0 byes)
 * - qualifying_elimination (any N >= 4, 2 qualifying rounds -> exact multiple-of-4 knockouts -> 1-match Final)
 * If config.format is omitted, automatically chooses rounds_all_play for multiples of 4 and
 * qualifying_elimination otherwise.
 */
export function simulateTournament(input: {
  participantCount: number;
  seed: string;
  config?: Partial<TournamentConfig>;
  overrideRounds?: number;
  participants?: readonly Participant[];
}): SimulationReport {
  const startMs = globalThis.performance.now();

  const initialParticipants = input.participants
    ? input.participants.map((p) => ({ ...p }))
    : createSampleParticipants(input.participantCount);

  const autoFormat: TournamentFormat =
    initialParticipants.length % 4 === 0 ? 'rounds_all_play' : 'qualifying_elimination';

  const config: TournamentConfig = {
    ...DEFAULT_TOURNAMENT_CONFIG,
    format: autoFormat,
    ...input.config
  };

  const plan = planTournament({
    participants: initialParticipants,
    config,
    seed: input.seed,
    ...(input.overrideRounds !== undefined ? { overrideRounds: input.overrideRounds } : {})
  });

  const simRng = new SeededRng(input.seed).fork('simulation-scores');
  const skillByPlayer = new Map<string, number>();
  for (const p of initialParticipants) {
    skillByPlayer.set(p.id, simRng.nextFloat());
  }

  let participants: Participant[] = initialParticipants;
  const completedRounds: CompletedRound[] = [];
  const reportRounds: SimulationRoundReport[] = [];
  let finalChampion: FinalChampionSummary | null = null;

  for (let r = 1; r <= plan.selectedRounds; r++) {
    const stage = plan.eliminationStages ? plan.eliminationStages[r - 1]! : null;
    const activeNow = participants.filter((p) => p.status === 'active');

    const generatedRound =
      r === 1
        ? plan.firstRoundPreview
        : plan.fixedSchedulePreview !== null
          ? plan.fixedSchedulePreview[r - 1]!
          : generateRound({
              roundNumber: r,
              activeParticipants: activeNow,
              plannedByes: plan.plannedByesByRound[r] ?? [],
              futurePlannedByesByRound: plan.plannedByesByRound,
              history: buildTournamentHistory(participants, completedRounds),
              standings: calculateStandings({
                participants,
                completedRounds,
                rankingMode: plan.rankingMode
              }),
              config,
              seed: input.seed
            });

    const recordedMatches: RecordedMatch[] = [];
    const roundMatchReports: SimulationRoundReport['matches'] = [];

    for (const m of generatedRound.matches) {
      const skillA =
        ((skillByPlayer.get(m.pairA[0]) ?? 0.5) + (skillByPlayer.get(m.pairA[1]) ?? 0.5)) / 2;
      const skillB =
        ((skillByPlayer.get(m.pairB[0]) ?? 0.5) + (skillByPlayer.get(m.pairB[1]) ?? 0.5)) / 2;

      const simulated = simulateRealisticMatchScore(simRng, config.targetScore, skillA, skillB);
      const validation = validateMatchScore({
        pairAScore: simulated.pairAScore,
        pairBScore: simulated.pairBScore,
        targetScore: config.targetScore,
        endedBy: simulated.endedBy
      });

      if (!validation.valid || validation.outcome === null) {
        throw new Error(
          `Simulación generó marcador inválido en R${r} Mesa ${m.tableNumber}: ${validation.errors.join('; ')}`
        );
      }

      recordedMatches.push({
        matchId: `R${r}-T${m.tableNumber}`,
        roundNumber: r,
        tableNumber: m.tableNumber,
        pairA: m.pairA,
        pairB: m.pairB,
        status: 'completed',
        pairAScore: simulated.pairAScore,
        pairBScore: simulated.pairBScore,
        winnerPair: validation.winnerPair,
        outcome: validation.outcome,
        endedBy: simulated.endedBy
      });

      roundMatchReports.push({
        tableNumber: m.tableNumber,
        pairA: m.pairA,
        pairB: m.pairB,
        pairAScore: simulated.pairAScore,
        pairBScore: simulated.pairBScore,
        winnerPair: validation.winnerPair,
        outcome: validation.outcome,
        endedBy: simulated.endedBy
      });
    }

    const roundPhase = stage?.phase ?? 'regular';
    const stageName = stage?.stageName ?? `Ronda ${r}`;

    const completedRound: CompletedRound = {
      roundNumber: r,
      phase: roundPhase,
      stageName,
      matches: recordedMatches,
      byes: generatedRound.byes,
      eliminatedParticipantIds: [],
      metrics: generatedRound.metrics,
      explanations: generatedRound.explanations
    };

    completedRounds.push(completedRound);

    let eliminatedIds: string[] = [];
    if (stage !== null) {
      const advancement = resolveStageAdvancement({
        stage,
        completedRound,
        allParticipants: participants,
        allCompletedRounds: completedRounds,
        rankingMode: plan.rankingMode
      });
      eliminatedIds = advancement.eliminatedIds;
      completedRound.eliminatedParticipantIds = eliminatedIds;

      if (stage.phase === 'final' && recordedMatches[0]) {
        finalChampion = resolveFinalChampion({
          finalMatch: recordedMatches[0],
          allParticipants: participants,
          allCompletedRounds: completedRounds,
          rankingMode: plan.rankingMode
        });
      }

      if (eliminatedIds.length > 0 && stage.phase !== 'final') {
        const elimSet = new Set(eliminatedIds);
        participants = participants.map((p) =>
          elimSet.has(p.id)
            ? { ...p, status: 'eliminated', eliminatedAfterRound: r }
            : p
        );
      }
    }

    reportRounds.push({
      roundNumber: r,
      phase: roundPhase,
      stageName,
      byes: generatedRound.byes,
      eliminatedParticipantIds: eliminatedIds,
      matches: roundMatchReports,
      metrics: generatedRound.metrics,
      explanations: generatedRound.explanations
    });
  }

  const finalStandings = calculateStandings({
    participants,
    completedRounds,
    rankingMode: plan.rankingMode
  });

  const summary = summarizeTournamentFairness(participants, completedRounds);
  const constraintViolations = validateTournamentConstraints({
    participants,
    rounds: completedRounds,
    config
  });

  const executionTimeMs = Number((globalThis.performance.now() - startMs).toFixed(2));

  return {
    schemaVersion: '1.1.0',
    format: config.format,
    seed: input.seed,
    config,
    participantCount: plan.participantCount,
    plannedRounds: plan.selectedRounds,
    tablesPerRound: plan.tablesPerRound,
    byesPerRound: plan.byesPerRound,
    rankingMode: plan.rankingMode,
    equalGamesAchieved: plan.equalGamesAchieved,
    executionTimeMs,
    stages: plan.eliminationStages,
    rulesSnapshot: plan.rulesDocument,
    rounds: reportRounds,
    summary,
    finalStandings,
    finalChampion,
    constraintViolations
  };
}
