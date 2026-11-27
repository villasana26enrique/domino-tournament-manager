import { DomainValidationError } from '../domain/errors.js';
import type {
  ParticipationMath,
  RankingMode,
  RoundCandidateEvaluation,
  RoundPlanRecommendation,
  TournamentConfig
} from '../domain/types.js';

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const tmp = y;
    y = x % y;
    x = tmp;
  }
  return x;
}

export function computeParticipationMath(
  participantCount: number,
  maxPhysicalTables: number | null
): ParticipationMath {
  if (!Number.isInteger(participantCount) || participantCount < 4) {
    throw new DomainValidationError(
      `Se requieren al menos 4 participantes para calcular mesas (recibidos: ${participantCount}).`
    );
  }

  const maxPossibleTables = Math.floor(participantCount / 4);
  const tablesPerRound =
    maxPhysicalTables === null
      ? maxPossibleTables
      : Math.min(maxPossibleTables, maxPhysicalTables);

  if (tablesPerRound < 1) {
    throw new DomainValidationError('Debe haber al menos 1 mesa física disponible.');
  }

  const activePerRound = tablesPerRound * 4;
  const byesPerRound = participantCount - activePerRound;
  const minEqualRounds =
    byesPerRound === 0 ? 1 : participantCount / gcd(participantCount, byesPerRound);
  const consecutiveByesUnavoidable = byesPerRound > activePerRound;

  return {
    participantCount,
    maxPossibleTables,
    tablesPerRound,
    activePerRound,
    byesPerRound,
    minEqualRounds,
    consecutiveByesUnavoidable
  };
}

function evaluateCandidate(
  rounds: number,
  math: ParticipationMath,
  config: TournamentConfig
): RoundCandidateEvaluation {
  const { participantCount: N, byesPerRound: B } = math;
  const totalByes = B * rounds;
  const minByesPerPlayer = Math.floor(totalByes / N);
  const maxByesPerPlayer = Math.ceil(totalByes / N);
  const minGamesPerPlayer = rounds - maxByesPerPlayer;
  const maxGamesPerPlayer = rounds - minByesPerPlayer;
  const equalGames = minGamesPerPlayer === maxGamesPerPlayer;

  const minutesPerRound = Math.round(config.roundDurationSeconds / 60);
  const estimatedDurationMinutes =
    rounds * minutesPerRound + Math.max(0, rounds - 1) * config.transitionMinutesBetweenRounds;

  // Each active player can partner with at most N - 1 distinct players.
  const forcesPartnerRepeats = maxGamesPerPlayer > N - 1;

  // Transparent, evaluable scoring function for short social tournaments (~2h to 3h30m)
  let score = 0;

  // 1. Equal participation is highly valuable when duration stays reasonable
  if (equalGames) {
    score += 45;
  }

  // 2. Social duration preference (sweet spot: 110–180 min; tolerable up to 215 min)
  if (estimatedDurationMinutes >= 110 && estimatedDurationMinutes <= 180) {
    score += 35;
  } else if (estimatedDurationMinutes > 180 && estimatedDurationMinutes <= 215) {
    score += 22;
  } else if (estimatedDurationMinutes >= 75 && estimatedDurationMinutes < 110) {
    score += 18;
  } else if (estimatedDurationMinutes > 215) {
    score -= Math.round((estimatedDurationMinutes - 215) * 0.8);
  } else {
    score -= 20;
  }

  // 3. Meaningful sample of games played per player (ideally 4–6; 3 acceptable for N=4)
  if (minGamesPerPlayer >= 4 && maxGamesPerPlayer <= 6) {
    score += 25;
  } else if (minGamesPerPlayer === 3 && N === 4) {
    score += 24;
  } else if (minGamesPerPlayer >= 3) {
    score += 10;
  } else {
    score -= 30;
  }

  // 4. Sweet-spot round count preference around 5 rounds for equal-game multiples of 4
  if (rounds === 5) {
    score += 8;
  } else if (rounds === 4 || rounds === 6) {
    score += 4;
  } else if (rounds === 7) {
    score += 2;
  }

  // 5. Avoid forcing partner repeats when avoidable (especially critical for N=4 -> R=3)
  if (forcesPartnerRepeats) {
    score -= 28;
  }

  // 6. Mild penalty when strict equality wasn't met and rounds is outside [4, 6]
  if (!equalGames && (rounds < 4 || rounds > 6)) {
    score -= 12;
  }

  const parts: string[] = [];
  parts.push(
    equalGames
      ? `igualdad exacta (${minGamesPerPlayer} partidas c/u)`
      : `diferencia máx. de 1 partida (${minGamesPerPlayer}–${maxGamesPerPlayer} partidas)`
  );
  parts.push(`~${estimatedDurationMinutes} min`);
  if (forcesPartnerRepeats) {
    parts.push('requiere repetir compañeros');
  }

  return {
    rounds,
    equalGames,
    minGamesPerPlayer,
    maxGamesPerPlayer,
    minByesPerPlayer,
    maxByesPerPlayer,
    estimatedDurationMinutes,
    forcesPartnerRepeats,
    score,
    rationale: parts.join(', ')
  };
}

function buildStrictEqualityRoundCount(math: ParticipationMath): number {
  const { participantCount: N, minEqualRounds } = math;
  if (math.byesPerRound === 0) {
    return N === 4 ? 3 : 5;
  }
  let rounds = minEqualRounds;
  // For N=6 (minEqualRounds=3 gives only 2 games each), prefer 6 rounds (4 games each)
  const minDesiredGames = N === 4 ? 3 : 4;
  while (rounds - Math.ceil((math.byesPerRound * rounds) / N) < minDesiredGames && rounds < 24) {
    rounds += minEqualRounds;
  }
  return rounds;
}

export function planRoundCount(
  participantCount: number,
  config: TournamentConfig,
  overrideRounds?: number
): RoundPlanRecommendation {
  const math = computeParticipationMath(participantCount, config.maxPhysicalTables);

  if (overrideRounds !== undefined) {
    if (!Number.isInteger(overrideRounds) || overrideRounds < 1 || overrideRounds > 50) {
      throw new DomainValidationError(
        `La cantidad de rondas debe ser un entero entre 1 y 50 (recibido: ${overrideRounds}).`
      );
    }
  }

  const candidateSet = new Set<number>([3, 4, 5, 6, 7]);
  if (math.minEqualRounds >= 3 && math.minEqualRounds <= 10) {
    candidateSet.add(math.minEqualRounds);
  }
  if (math.minEqualRounds * 2 <= 8) {
    candidateSet.add(math.minEqualRounds * 2);
  }
  if (overrideRounds !== undefined) {
    candidateSet.add(overrideRounds);
  }

  const candidates = [...candidateSet]
    .sort((a, b) => a - b)
    .map((r) => evaluateCandidate(r, math, config));

  const bestSocial = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.rounds - b.rounds;
  })[0]!;

  const recommendedRounds =
    config.roundPlanningMode === 'strict_equality'
      ? buildStrictEqualityRoundCount(math)
      : bestSocial.rounds;

  const selectedRounds = overrideRounds ?? recommendedRounds;
  const selectedEval =
    candidates.find((c) => c.rounds === selectedRounds) ??
    evaluateCandidate(selectedRounds, math, config);

  const rankingMode: RankingMode = selectedEval.equalGames ? 'equal_games' : 'unequal_games';

  const explanations: string[] = [];
  const warnings: string[] = [];

  explanations.push(
    `Con ${math.participantCount} participantes se conforman ${math.tablesPerRound} ${
      math.tablesPerRound === 1 ? 'mesa simultánea' : 'mesas simultáneas'
    } (${math.activePerRound} activos y ${math.byesPerRound} ${
      math.byesPerRound === 1 ? 'descanso' : 'descansos'
    } por ronda).`
  );

  if (selectedEval.equalGames) {
    explanations.push(
      `En ${selectedRounds} rondas todos los jugadores disputan exactamente ${selectedEval.minGamesPerPlayer} partidas y descansan ${selectedEval.minByesPerPlayer} ${
        selectedEval.minByesPerPlayer === 1 ? 'vez' : 'veces'
      }. La clasificación usará victorias totales y diferencia de puntos.`
    );
  } else {
    explanations.push(
      `Lograr igualdad estricta con ${math.participantCount} participantes requeriría al menos ${math.minEqualRounds} rondas. Para mantener un torneo corto (~${selectedEval.estimatedDurationMinutes} min), se programan ${selectedRounds} rondas: cada jugador disputará ${selectedEval.minGamesPerPlayer} o ${selectedEval.maxGamesPerPlayer} partidas (diferencia máxima de 1).`
    );
    explanations.push(
      'Por existir una diferencia de 1 partida entre participantes, el reglamento activa de forma fija el criterio de porcentaje de victorias seguido de victorias totales y diferencia promedio.'
    );
  }

  if (math.maxPossibleTables > math.tablesPerRound) {
    warnings.push(
      `Existe un límite físico configurado de ${math.tablesPerRound} mesas (sin límite podrían jugarse ${math.maxPossibleTables} mesas).`
    );
  }

  if (math.consecutiveByesUnavoidable) {
    warnings.push(
      `Debido al límite físico de mesas, descansan más jugadores (${math.byesPerRound}) de los que juegan (${math.activePerRound}) por ronda; algunos descansos consecutivos son matemáticamente inevitables.`
    );
  }

  if (selectedEval.forcesPartnerRepeats) {
    warnings.push(
      `Con ${math.participantCount} jugadores y ${selectedEval.maxGamesPerPlayer} partidas, cada jugador tiene solo ${
        math.participantCount - 1
      } compañeros posibles, por lo que será inevitable repetir al menos un compañero.`
    );
  }

  if (selectedEval.estimatedDurationMinutes > 215) {
    warnings.push(
      `La duración estimada (${selectedEval.estimatedDurationMinutes} min) supera la referencia habitual de un torneo social corto (3h 30m).`
    );
  }

  if (!selectedEval.equalGames && config.maxPhysicalTables === null) {
    const downOne = math.participantCount - 1;
    const upOne = math.participantCount + 1;
    const hints: string[] = [];
    if (downOne >= 4 && downOne % 4 === 0) {
      hints.push(`${downOne} jugadores (0 descansos)`);
    } else if (downOne >= 4 && downOne / gcd(downOne, downOne % 4) <= 7) {
      hints.push(`${downOne} jugadores (igualdad en ${downOne / gcd(downOne, downOne % 4)} rondas)`);
    }
    if (upOne % 4 === 0) {
      hints.push(`${upOne} jugadores (0 descansos)`);
    } else if (upOne / gcd(upOne, upOne % 4) <= 7) {
      hints.push(`${upOne} jugadores (igualdad en ${upOne / gcd(upOne, upOne % 4)} rondas)`);
    }
    if (hints.length > 0) {
      warnings.push(
        `Sugerencia organizativa: con ${hints.join(' o ')} se lograría igualdad exacta de partidas sin alargar el torneo.`
      );
    }
  }

  return {
    math,
    recommendedRounds,
    selectedRounds,
    equalGamesAchieved: selectedEval.equalGames,
    minGamesPerPlayer: selectedEval.minGamesPerPlayer,
    maxGamesPerPlayer: selectedEval.maxGamesPerPlayer,
    minByesPerPlayer: selectedEval.minByesPerPlayer,
    maxByesPerPlayer: selectedEval.maxByesPerPlayer,
    rankingMode,
    estimatedDurationMinutes: selectedEval.estimatedDurationMinutes,
    candidates,
    explanations,
    warnings
  };
}
