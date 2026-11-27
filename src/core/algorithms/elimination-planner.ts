import { DomainValidationError } from '../domain/errors.js';
import type {
  CompletedRound,
  EliminationStagePlan,
  FinalChampionSummary,
  FormatAvailability,
  Participant,
  RankingMode,
  RecordedMatch,
  StandingRow,
  TournamentConfig
} from '../domain/types.js';
import { SeededRng } from '../prng/seeded-rng.js';
import { calculateStandings } from './ranking-calculator.js';
import { computeParticipationMath } from './round-count-planner.js';

/**
 * Returns the tournament formats available for a given participant count (ADR-008):
 * - "Por rondas (todos juegan hasta el final)" is available ONLY when N is a multiple of 4 (0 byes).
 * - "Clasificatoria con eliminaciones hasta la Final" is ALWAYS available for any N >= 4.
 */
export function getAvailableTournamentFormats(participantCount: number): FormatAvailability[] {
  if (!Number.isInteger(participantCount) || participantCount < 4) {
    throw new DomainValidationError(
      `Se requieren al menos 4 participantes (recibidos: ${participantCount}).`
    );
  }

  const isMultipleOf4 = participantCount % 4 === 0;
  const lowerMultiple = Math.floor(participantCount / 4) * 4;
  const upperMultiple = lowerMultiple + 4;
  const missingForUp = upperMultiple - participantCount;
  const excessForDown = participantCount - lowerMultiple;

  return [
    {
      format: 'rounds_all_play',
      title: 'Por rondas (todos juegan hasta el final)',
      available: isMultipleOf4,
      recommended: isMultipleOf4,
      reason: isMultipleOf4
        ? `Con ${participantCount} jugadores se forman ${
            participantCount / 4
          } mesas exactas sin descansos: todos juegan las mismas rondas.`
        : `Solo disponible para múltiplos de 4 para evitar desventajas por descansos. Con ${participantCount} jugadores sobra${
            excessForDown === 1 ? '' : 'n'
          } ${excessForDown} (para ${lowerMultiple}) o falta${
            missingForUp === 1 ? '' : 'n'
          } ${missingForUp} (para ${upperMultiple}).`
    },
    {
      format: 'qualifying_elimination',
      title: 'Clasificatoria con eliminaciones hasta la Final',
      available: true,
      recommended: !isMultipleOf4,
      reason: isMultipleOf4
        ? 'Rondas clasificatorias seguidas de eliminatorias exactas (múltiplo de 4) hasta una Gran Final de 4 jugadores.'
        : `Formato recomendado para ${participantCount} jugadores: clasificatoria corta (con pase libre al azar en R1 para quienes descansen) seguida de eliminatorias exactas sin descansos hasta la Gran Final.`
    }
  ];
}

/**
 * Plans the progressive stages for "Clasificatoria con eliminaciones hasta la Final" (ADR-008):
 * - Always uses 2 qualifying rounds first so partners rotate before the cut (preventing unfair coin-flip splits
 *   on tied pairs when N is odd). Players who get a random bye in R1 advance automatically to R2 and play R2.
 * - Then cuts directly to an exact power/multiple-of-4 knockout bracket (0 byes):
 *   - N in [4..7]   => Top 4 (Gran Final) -> 3 rounds total
 *   - N in [8..15]  => Top 8 (Semifinal) -> Top 4 (Gran Final) -> 4 rounds total
 *   - N >= 16       => Top 16 (Cuartos) -> Top 8 (Semifinal) -> Top 4 (Gran Final) -> 5 rounds total
 * - Grand Final is 1 single decisive match (4 finalists): the winning pair wins the Final and its higher-ranked
 *   player overall is crowned Individual Champion.
 */
export function planEliminationStages(
  participantCount: number,
  config: TournamentConfig
): EliminationStagePlan[] {
  const math = computeParticipationMath(participantCount, config.maxPhysicalTables);
  const stages: EliminationStagePlan[] = [];

  const firstKnockoutSize = participantCount >= 16 ? 16 : participantCount >= 8 ? 8 : 4;

  // Qualifying Round 1: everyone participates; if N mod 4 != 0, B players get random free pass to R2
  stages.push({
    roundNumber: 1,
    phase: 'qualifying',
    stageName: 'Clasificatoria 1',
    expectedParticipants: participantCount,
    tablesCount: math.tablesPerRound,
    byesCount: math.byesPerRound,
    advancesCount: participantCount
  });

  // Qualifying Round 2: partners rotate; players who rested in R1 play; cut down to firstKnockoutSize
  stages.push({
    roundNumber: 2,
    phase: 'qualifying',
    stageName: 'Clasificatoria 2 (Corte)',
    expectedParticipants: participantCount,
    tablesCount: math.tablesPerRound,
    byesCount: math.byesPerRound,
    advancesCount: firstKnockoutSize
  });

  let nextRound = 3;
  let currentSize = firstKnockoutSize;

  while (currentSize > 4) {
    const tablesCount =
      config.maxPhysicalTables === null
        ? currentSize / 4
        : Math.min(currentSize / 4, config.maxPhysicalTables);
    const stageName =
      currentSize === 16
        ? 'Cuartos de Final'
        : currentSize === 8
          ? 'Semifinal'
          : `Eliminatoria Top ${currentSize}`;

    stages.push({
      roundNumber: nextRound,
      phase: 'elimination',
      stageName,
      expectedParticipants: currentSize,
      tablesCount,
      byesCount: 0,
      advancesCount: currentSize / 2
    });

    currentSize = currentSize / 2;
    nextRound += 1;
  }

  // Grand Final: 4 finalists, 1 table, 1 decisive match
  stages.push({
    roundNumber: nextRound,
    phase: 'final',
    stageName: 'Gran Final',
    expectedParticipants: 4,
    tablesCount: 1,
    byesCount: 0,
    advancesCount: 2 // Winning pair of 2 (with 1 individual champion)
  });

  return stages;
}

/**
 * Determines who advances and who is eliminated after completing a stage in qualifying_elimination.
 */
export function resolveStageAdvancement(input: {
  stage: EliminationStagePlan;
  completedRound: CompletedRound;
  allParticipants: readonly Participant[];
  allCompletedRounds: readonly CompletedRound[];
  rankingMode: RankingMode;
}): {
  advancingIds: string[];
  eliminatedIds: string[];
} {
  const { stage, completedRound, allParticipants, allCompletedRounds, rankingMode } = input;

  const activeBeforeRound = allParticipants.filter((p) => p.status === 'active');

  // Qualifying 1: no eliminations yet (random bye players from R1 pass directly to R2)
  if (stage.phase === 'qualifying' && stage.advancesCount >= activeBeforeRound.length) {
    return {
      advancingIds: activeBeforeRound.map((p) => p.id),
      eliminatedIds: []
    };
  }

  const standings = calculateStandings({
    participants: allParticipants,
    completedRounds: allCompletedRounds,
    rankingMode
  });
  const activeStandings = standings.filter((row) => row.status === 'active');
  const rankIndexById = new Map<string, number>();
  activeStandings.forEach((row, idx) => rankIndexById.set(row.participantId, idx));

  // Cut after Qualifying 2: top `advancesCount` advance based on standings
  if (stage.phase === 'qualifying') {
    const advancingIds = activeStandings
      .slice(0, stage.advancesCount)
      .map((row) => row.participantId);
    const advancingSet = new Set(advancingIds);
    const eliminatedIds = activeStandings
      .filter((row) => !advancingSet.has(row.participantId))
      .map((row) => row.participantId);
    return { advancingIds, eliminatedIds };
  }

  // Knockout rounds (Cuartos 16->8, Semifinal 8->4): winning pair of each table advances!
  if (stage.phase === 'elimination') {
    const advancingIds: string[] = [];
    const eliminatedIds: string[] = [];

    for (const match of completedRound.matches) {
      let winnerSide = match.winnerPair;
      if (winnerSide === null) {
        // Rare time-expired draw in knockout: pair with better combined cumulative standing advances
        const rankSumA =
          (rankIndexById.get(match.pairA[0]) ?? 999) + (rankIndexById.get(match.pairA[1]) ?? 999);
        const rankSumB =
          (rankIndexById.get(match.pairB[0]) ?? 999) + (rankIndexById.get(match.pairB[1]) ?? 999);
        winnerSide = rankSumA <= rankSumB ? 'A' : 'B';
      }

      if (winnerSide === 'A') {
        advancingIds.push(...match.pairA);
        eliminatedIds.push(...match.pairB);
      } else {
        advancingIds.push(...match.pairB);
        eliminatedIds.push(...match.pairA);
      }
    }

    return { advancingIds, eliminatedIds };
  }

  // Grand Final: winning pair stays on top, losing pair finishes 3rd/4th
  const finalMatch = completedRound.matches[0];
  if (!finalMatch) {
    return { advancingIds: [], eliminatedIds: [] };
  }

  const championSummary = resolveFinalChampion({
    finalMatch,
    allParticipants,
    allCompletedRounds,
    rankingMode
  });

  const winningIds = championSummary.winningPair.map((r) => r.participantId);
  const winningSet = new Set(winningIds);
  const eliminatedIds = [...finalMatch.pairA, ...finalMatch.pairB].filter(
    (id) => !winningSet.has(id)
  );
  return { advancingIds: winningIds, eliminatedIds };
}

/**
 * Resolves the 1-match Grand Final (ADR-008):
 * - Identifies the winning pair of the Final.
 * - Between the 2 members of the winning pair, crowns the Individual Champion based on
 *   cumulative tournament performance (including the Final).
 */
export function resolveFinalChampion(input: {
  finalMatch: RecordedMatch;
  allParticipants: readonly Participant[];
  allCompletedRounds: readonly CompletedRound[];
  rankingMode: RankingMode;
}): FinalChampionSummary {
  const { finalMatch, allParticipants, allCompletedRounds, rankingMode } = input;
  const standings = calculateStandings({
    participants: allParticipants,
    completedRounds: allCompletedRounds,
    rankingMode
  });
  const byId = new Map<string, StandingRow>(standings.map((row) => [row.participantId, row]));
  const rankIdx = new Map<string, number>();
  standings.forEach((row, idx) => rankIdx.set(row.participantId, idx));

  let decidedByTieBreak = false;
  let winningIds: [string, string];

  if (finalMatch.winnerPair === 'A') {
    winningIds = finalMatch.pairA;
  } else if (finalMatch.winnerPair === 'B') {
    winningIds = finalMatch.pairB;
  } else {
    // Rare time-expired draw in the Final: decide by better cumulative standings of the pair
    decidedByTieBreak = true;
    const sumA =
      (rankIdx.get(finalMatch.pairA[0]) ?? 999) + (rankIdx.get(finalMatch.pairA[1]) ?? 999);
    const sumB =
      (rankIdx.get(finalMatch.pairB[0]) ?? 999) + (rankIdx.get(finalMatch.pairB[1]) ?? 999);
    winningIds = sumA <= sumB ? finalMatch.pairA : finalMatch.pairB;
  }

  const p1 = byId.get(winningIds[0])!;
  const p2 = byId.get(winningIds[1])!;
  const p1Better = (rankIdx.get(p1.participantId) ?? 999) <= (rankIdx.get(p2.participantId) ?? 999);

  const orderedPair: [StandingRow, StandingRow] = p1Better ? [p1, p2] : [p2, p1];
  return {
    individualChampion: orderedPair[0],
    winningPair: orderedPair,
    finalMatch,
    decidedByTieBreak
  };
}

/**
 * Replaces an active participant with a substitute mid-tournament, preserving the exact table
 * count and multiple-of-4 structure without creating byes or altering completed rounds.
 */
export function substituteParticipant(input: {
  participants: readonly Participant[];
  targetParticipantId: string;
  substituteDisplayName: string;
  substitutePlayerId: string;
}): Participant[] {
  const { participants, targetParticipantId, substituteDisplayName, substitutePlayerId } = input;
  const trimmedName = substituteDisplayName.trim();
  if (trimmedName.length === 0) {
    throw new DomainValidationError('El nombre del sustituto no puede estar vacío.');
  }

  const target = participants.find((p) => p.id === targetParticipantId);
  if (!target) {
    throw new DomainValidationError(`No existe el participante ${targetParticipantId}.`);
  }
  if (target.status !== 'active') {
    throw new DomainValidationError(
      `Solo se puede sustituir a un participante activo (estado actual: ${target.status}).`
    );
  }

  return participants.map((p) =>
    p.id === targetParticipantId
      ? {
          ...p,
          playerId: substitutePlayerId,
          displayName: trimmedName,
          isSubstitute: true,
          substitutedForName: p.displayName
        }
      : p
  );
}

/**
 * Selects Round 2 ("Clasificatoria 2") byes in qualifying_elimination when N mod 4 != 0 (ADR-012).
 * Prioritizes Round 1 winners (excluding players who already rested in Round 1) so no Round 1
 * loser misses their second qualifying round. Deterministic given the tournament seed.
 */
export function selectQualifyingRound2Byes(input: {
  activeParticipants: readonly Participant[];
  r1Standings: readonly StandingRow[];
  r1ByeParticipantIds: readonly string[];
  byeCount: number;
  seed: string;
}): string[] {
  const { activeParticipants, r1Standings, r1ByeParticipantIds, byeCount, seed } = input;
  if (byeCount <= 0 || activeParticipants.length === 0) {
    return [];
  }

  const r1ByeSet = new Set(r1ByeParticipantIds);
  const eligibleNoRepeat = activeParticipants.filter((p) => !r1ByeSet.has(p.id));
  const pool = eligibleNoRepeat.length >= byeCount ? eligibleNoRepeat : [...activeParticipants];

  const standingById = new Map(r1Standings.map((s) => [s.participantId, s]));
  const tieOrder = new SeededRng(`${seed}::qualifying-r2-byes`).shuffle(
    pool.map((p) => p.id)
  );
  const tieRank = new Map(tieOrder.map((id, idx) => [id, idx]));

  const sorted = [...pool].sort((a, b) => {
    const sa = standingById.get(a.id);
    const sb = standingById.get(b.id);

    const winsDiff = (sb?.wins ?? 0) - (sa?.wins ?? 0);
    if (winsDiff !== 0) return winsDiff;

    const drawsDiff = (sb?.draws ?? 0) - (sa?.draws ?? 0);
    if (drawsDiff !== 0) return drawsDiff;

    const pointDiffDelta = (sb?.pointDiff ?? 0) - (sa?.pointDiff ?? 0);
    if (pointDiffDelta !== 0) return pointDiffDelta;

    return (tieRank.get(a.id) ?? 0) - (tieRank.get(b.id) ?? 0);
  });

  return sorted.slice(0, byeCount).map((p) => p.id);
}
