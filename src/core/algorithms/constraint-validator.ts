import type {
  CompletedRound,
  ConstraintViolation,
  GeneratedRound,
  Participant,
  TournamentConfig
} from '../domain/types.js';
import { computeParticipationMath } from './round-count-planner.js';

/**
 * Independently verifies ALL mandatory hard constraints for a single round.
 */
export function validateRoundConstraints(input: {
  round: GeneratedRound | CompletedRound;
  activeParticipants: readonly Participant[];
  maxPhysicalTables: number | null;
  previousRoundByes?: readonly string[];
}): ConstraintViolation[] {
  const { round, activeParticipants, maxPhysicalTables, previousRoundByes } = input;
  const violations: ConstraintViolation[] = [];

  const activeIds = new Set(
    activeParticipants.filter((p) => p.status === 'active').map((p) => p.id)
  );
  const math = computeParticipationMath(activeIds.size, maxPhysicalTables);

  // 1. Exact expected number of full tables
  if (round.matches.length !== math.tablesPerRound) {
    violations.push({
      code: 'WRONG_TABLE_COUNT',
      roundNumber: round.roundNumber,
      message: `Se esperaban ${math.tablesPerRound} mesas completas y se generaron ${round.matches.length}.`
    });
  }

  // 2. Exact expected number of byes
  if (round.byes.length !== math.byesPerRound) {
    violations.push({
      code: 'WRONG_BYE_COUNT',
      roundNumber: round.roundNumber,
      message: `Se esperaban ${math.byesPerRound} descansos y se asignaron ${round.byes.length}.`
    });
  }

  const seenInMatches = new Set<string>();
  const seenTableNumbers = new Set<number>();

  for (const match of round.matches) {
    if (seenTableNumbers.has(match.tableNumber)) {
      violations.push({
        code: 'DUPLICATE_TABLE_NUMBER',
        roundNumber: round.roundNumber,
        tableNumber: match.tableNumber,
        message: `Número de mesa duplicado: Mesa ${match.tableNumber}.`
      });
    }
    seenTableNumbers.add(match.tableNumber);

    const playersInMatch = [...match.pairA, ...match.pairB];
    if (playersInMatch.length !== 4) {
      violations.push({
        code: 'INCOMPLETE_TABLE',
        roundNumber: round.roundNumber,
        tableNumber: match.tableNumber,
        message: `La Mesa ${match.tableNumber} no tiene exactamente 4 jugadores.`
      });
    }

    const matchLocalSet = new Set<string>();
    for (const pid of playersInMatch) {
      if (!activeIds.has(pid)) {
        violations.push({
          code: 'INACTIVE_OR_UNKNOWN_PLAYER',
          roundNumber: round.roundNumber,
          tableNumber: match.tableNumber,
          message: `El jugador ${pid} en la Mesa ${match.tableNumber} no está activo.`
        });
      }
      if (matchLocalSet.has(pid)) {
        violations.push({
          code: 'DUPLICATE_PLAYER_IN_MATCH',
          roundNumber: round.roundNumber,
          tableNumber: match.tableNumber,
          message: `El jugador ${pid} aparece repetido dentro de la Mesa ${match.tableNumber}.`
        });
      }
      matchLocalSet.add(pid);

      if (seenInMatches.has(pid)) {
        violations.push({
          code: 'DUPLICATE_PLAYER_IN_ROUND',
          roundNumber: round.roundNumber,
          tableNumber: match.tableNumber,
          message: `El jugador ${pid} participa en más de una mesa en la Ronda ${round.roundNumber}.`
        });
      }
      seenInMatches.add(pid);
    }
  }

  const seenByes = new Set<string>();
  for (const byeId of round.byes) {
    if (!activeIds.has(byeId)) {
      violations.push({
        code: 'INACTIVE_BYE_PLAYER',
        roundNumber: round.roundNumber,
        message: `El jugador en descanso ${byeId} no está activo.`
      });
    }
    if (seenByes.has(byeId)) {
      violations.push({
        code: 'DUPLICATE_BYE_PLAYER',
        roundNumber: round.roundNumber,
        message: `El jugador ${byeId} aparece duplicado en descansos de la Ronda ${round.roundNumber}.`
      });
    }
    if (seenInMatches.has(byeId)) {
      violations.push({
        code: 'PLAYER_BOTH_PLAYING_AND_BYE',
        roundNumber: round.roundNumber,
        message: `El jugador ${byeId} figura jugando y descansando en la Ronda ${round.roundNumber}.`
      });
    }
    seenByes.add(byeId);
  }

  // Every active player must be accounted for exactly once (either playing or bye)
  for (const pid of activeIds) {
    if (!seenInMatches.has(pid) && !seenByes.has(pid)) {
      violations.push({
        code: 'MISSING_ACTIVE_PLAYER',
        roundNumber: round.roundNumber,
        message: `El jugador activo ${pid} no fue asignado a mesa ni a descanso en la Ronda ${round.roundNumber}.`
      });
    }
  }

  // Consecutive byes check when avoidable
  if (previousRoundByes && !math.consecutiveByesUnavoidable) {
    const prevSet = new Set(previousRoundByes);
    for (const byeId of round.byes) {
      if (prevSet.has(byeId)) {
        violations.push({
          code: 'AVOIDABLE_CONSECUTIVE_BYE',
          roundNumber: round.roundNumber,
          message: `El jugador ${byeId} descansó de forma consecutiva en las rondas ${
            round.roundNumber - 1
          } y ${round.roundNumber}.`
        });
      }
    }
  }

  return violations;
}

/**
 * Independently verifies ALL hard constraints across an entire tournament.
 */
export function validateTournamentConstraints(input: {
  participants: readonly Participant[];
  rounds: readonly (GeneratedRound | CompletedRound)[];
  config: TournamentConfig;
  allowMidTournamentWithdrawals?: boolean;
}): ConstraintViolation[] {
  const { participants, rounds, config, allowMidTournamentWithdrawals = false } = input;
  const violations: ConstraintViolation[] = [];

  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const byeCounts = new Map<string, number>();
  for (const p of participants) {
    byeCounts.set(p.id, 0);
  }

  let prevByes: readonly string[] | undefined;

  for (const round of sortedRounds) {
    const activeForRound = participants.filter((p) => {
      if (p.withdrawnAfterRound !== null && round.roundNumber > p.withdrawnAfterRound) {
        return false;
      }
      if (
        p.eliminatedAfterRound !== undefined &&
        p.eliminatedAfterRound !== null &&
        round.roundNumber > p.eliminatedAfterRound
      ) {
        return false;
      }
      return true;
    });

    const roundViolations = validateRoundConstraints({
      round,
      activeParticipants: activeForRound.map((p) => ({ ...p, status: 'active' })),
      maxPhysicalTables: config.maxPhysicalTables,
      ...(prevByes !== undefined ? { previousRoundByes: prevByes } : {})
    });
    violations.push(...roundViolations);

    // Elimination & Final stages in qualifying_elimination must NEVER have byes
    if (
      config.format === 'qualifying_elimination' &&
      (round.phase === 'elimination' || round.phase === 'final') &&
      round.byes.length > 0
    ) {
      violations.push({
        code: 'BYE_IN_ELIMINATION_STAGE',
        roundNumber: round.roundNumber,
        message: `La fase eliminatoria (${round.stageName ?? `Ronda ${round.roundNumber}`}) no puede tener descansos.`
      });
    }

    for (const byeId of round.byes) {
      byeCounts.set(byeId, (byeCounts.get(byeId) ?? 0) + 1);
    }
    prevByes = round.byes;
  }

  // Bye balance across players who participated in all qualifying/regular rounds
  if (!allowMidTournamentWithdrawals && config.format === 'rounds_all_play') {
    const counts = participants
      .filter((p) => p.status === 'active')
      .map((p) => byeCounts.get(p.id) ?? 0);
    if (counts.length > 0) {
      const spread = Math.max(...counts) - Math.min(...counts);
      if (spread > 1) {
        violations.push({
          code: 'UNBALANCED_BYES',
          message: `Los descansos acumulados están desbalanceados (diferencia máxima de ${spread} descansos).`
        });
      }
    }
  }

  return violations;
}
