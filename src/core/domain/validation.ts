import { z } from 'zod';
import { DomainValidationError } from './errors.js';
import type {
  MatchEndReason,
  MatchOutcome,
  PairSide,
  Participant,
  ScoreValidationResult,
  TournamentConfig
} from './types.js';

export const tournamentConfigSchema = z
  .object({
    format: z.enum(['rounds_all_play', 'qualifying_elimination']),
    targetScore: z.number().int().min(50).max(300),
    roundDurationSeconds: z.number().int().min(300).max(7200),
    warningBeforeEndSeconds: z.number().int().min(0).max(3600),
    maxPhysicalTables: z.number().int().min(1).max(100).nullable(),
    tieResolutionRule: z.literal('allow_draw_on_time'),
    finalTieBreaker: z.enum(['playoff_match', 'shared_title']),
    schedulingMode: z.enum(['hybrid_competitive', 'fixed_schedule']),
    roundPlanningMode: z.enum(['recommended_duration', 'strict_equality']),
    allowCompetitivePairing: z.boolean(),
    transitionMinutesBetweenRounds: z.number().int().min(0).max(30)
  })
  .refine((cfg) => cfg.warningBeforeEndSeconds < cfg.roundDurationSeconds, {
    message: 'El aviso previo debe ser menor a la duración total de la ronda.',
    path: ['warningBeforeEndSeconds']
  });

export const participantSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  number: z.number().int().min(1),
  displayName: z.string().trim().min(1).max(80),
  status: z.enum(['active', 'withdrawn', 'eliminated']),
  withdrawnAfterRound: z.number().int().min(0).nullable(),
  eliminatedAfterRound: z.number().int().min(0).nullable().optional(),
  isSubstitute: z.boolean().optional(),
  substitutedForName: z.string().trim().min(1).max(80).nullable().optional()
});

export function validateTournamentConfig(config: TournamentConfig): TournamentConfig {
  const parsed = tournamentConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new DomainValidationError(
      'La configuración del torneo contiene valores inválidos.',
      parsed.error.flatten()
    );
  }
  return parsed.data;
}

export function validateParticipants(participants: readonly Participant[]): Participant[] {
  if (participants.length < 4) {
    throw new DomainValidationError(
      `Se requieren al menos 4 participantes para organizar una mesa (recibidos: ${participants.length}).`
    );
  }

  const seenIds = new Set<string>();
  const seenNumbers = new Set<number>();
  const validated: Participant[] = [];

  for (const participant of participants) {
    const parsed = participantSchema.safeParse(participant);
    if (!parsed.success) {
      throw new DomainValidationError(
        `Participante inválido (${participant.id || 'sin-id'}).`,
        parsed.error.flatten()
      );
    }

    if (seenIds.has(parsed.data.id)) {
      throw new DomainValidationError(`ID de participante duplicado: ${parsed.data.id}.`);
    }
    if (seenNumbers.has(parsed.data.number)) {
      throw new DomainValidationError(
        `Número de participante duplicado: #${parsed.data.number}.`
      );
    }

    seenIds.add(parsed.data.id);
    seenNumbers.add(parsed.data.number);
    const normalized: Participant = {
      id: parsed.data.id,
      playerId: parsed.data.playerId,
      number: parsed.data.number,
      displayName: parsed.data.displayName,
      status: parsed.data.status,
      withdrawnAfterRound: parsed.data.withdrawnAfterRound,
      ...(parsed.data.eliminatedAfterRound !== undefined
        ? { eliminatedAfterRound: parsed.data.eliminatedAfterRound }
        : {}),
      ...(parsed.data.isSubstitute !== undefined
        ? { isSubstitute: parsed.data.isSubstitute }
        : {}),
      ...(parsed.data.substitutedForName !== undefined
        ? { substitutedForName: parsed.data.substitutedForName }
        : {})
    };
    validated.push(normalized);
  }

  const activeCount = validated.filter((p) => p.status === 'active').length;
  if (activeCount < 4) {
    throw new DomainValidationError(
      `Se requieren al menos 4 participantes activos para disputar una ronda (activos: ${activeCount}).`
    );
  }

  return validated;
}

export function validateSeed(seed: string): string {
  const normalized = seed.trim();
  if (normalized.length === 0) {
    throw new DomainValidationError('La semilla del torneo no puede estar vacía.');
  }
  return normalized;
}

/**
 * Validates match scores for social double-6 domino rules (ADR-002 & ADR-007):
 * - Hard errors: negative/non-integer scores, both pairs >= targetScore, draw with endedBy='target_score'.
 * - Draws (pairAScore === pairBScore) ARE valid when endedBy='time_expired' or 'admin_override'
 *   (no sudden death, no winner/loser; exact scores are recorded).
 * - Soft warnings: unusually high winning score (> targetScore + 85), or endedBy='target_score'
 *   when neither pair reached targetScore.
 * - Never caps or rejects legitimate scores exceeding targetScore (e.g., 133 vs 84).
 */
export function validateMatchScore(input: {
  pairAScore: number;
  pairBScore: number;
  targetScore: number;
  endedBy: MatchEndReason;
}): ScoreValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { pairAScore, pairBScore, targetScore, endedBy } = input;

  if (!Number.isInteger(pairAScore) || pairAScore < 0) {
    errors.push('La puntuación de la Pareja A debe ser un entero mayor o igual a 0.');
  }
  if (!Number.isInteger(pairBScore) || pairBScore < 0) {
    errors.push('La puntuación de la Pareja B debe ser un entero mayor o igual a 0.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, winnerPair: null, outcome: null };
  }

  if (pairAScore >= targetScore && pairBScore >= targetScore) {
    errors.push(
      `Resultado físicamente imposible: ambas parejas alcanzaron o superaron el objetivo de ${targetScore} puntos.`
    );
  }

  if (pairAScore === pairBScore && endedBy === 'target_score') {
    errors.push(
      'Una partida terminada por objetivo de puntos no puede finalizar empatada.'
    );
  }

  if (pairAScore === 0 && pairBScore === 0 && endedBy === 'target_score') {
    errors.push('Ambas parejas no pueden finalizar 0-0 en una partida por objetivo.');
  }

  const maxScore = Math.max(pairAScore, pairBScore);

  if (endedBy === 'target_score' && maxScore < targetScore) {
    warnings.push(
      `La partida figura cerrada por objetivo (${targetScore} pts), pero el ganador tiene ${maxScore} pts.`
    );
  }

  const softUpperThreshold = targetScore + 85;
  if (maxScore > softUpperThreshold) {
    warnings.push(
      `Puntuación inusualmente alta (${maxScore} pts para objetivo de ${targetScore}). Verifica que no haya un error de digitación.`
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, winnerPair: null, outcome: null };
  }

  let winnerPair: PairSide | null = null;
  let outcome: MatchOutcome = 'draw';
  if (pairAScore > pairBScore) {
    winnerPair = 'A';
    outcome = 'pair_a_win';
  } else if (pairBScore > pairAScore) {
    winnerPair = 'B';
    outcome = 'pair_b_win';
  }

  return { valid: true, errors, warnings, winnerPair, outcome };
}
