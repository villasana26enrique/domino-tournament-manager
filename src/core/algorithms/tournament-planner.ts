import { DomainValidationError } from '../domain/errors.js';
import type {
  EliminationStagePlan,
  GeneratedRound,
  Participant,
  RankingMode,
  RoundPlanRecommendation,
  TournamentConfig,
  TournamentPlan
} from '../domain/types.js';
import {
  validateParticipants,
  validateSeed,
  validateTournamentConfig
} from '../domain/validation.js';
import { scheduleByes } from './bye-scheduler.js';
import {
  getAvailableTournamentFormats,
  planEliminationStages
} from './elimination-planner.js';
import { buildTournamentHistory, createEmptyHistory } from './history.js';
import { generateRound } from './matchmaking-engine.js';
import { computeParticipationMath, planRoundCount } from './round-count-planner.js';
import { generateTournamentRules } from '../rules/rule-generator.js';

/**
 * Produces the complete pre-start tournament plan for BOTH approved formats (ADR-008):
 * 1. rounds_all_play: available ONLY when N is a multiple of 4 (0 byes, equal games for all).
 * 2. qualifying_elimination: available for ANY N >= 4 (2 qualifying rounds + exact multiple-of-4
 *    knockout stages down to a 1-match Grand Final of 4).
 */
export function planTournament(input: {
  participants: readonly Participant[];
  config: TournamentConfig;
  seed: string;
  overrideRounds?: number;
}): TournamentPlan {
  const config = validateTournamentConfig(input.config);
  const participants = validateParticipants(input.participants);
  const seed = validateSeed(input.seed);

  const active = participants
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.number - b.number);

  const availableFormats = getAvailableTournamentFormats(active.length);

  if (config.format === 'rounds_all_play' && active.length % 4 !== 0) {
    const info = availableFormats.find((f) => f.format === 'rounds_all_play')!;
    throw new DomainValidationError(
      `La modalidad "Por rondas" solo está disponible para múltiplos de 4. ${info.reason}`
    );
  }

  if (config.format === 'qualifying_elimination') {
    const stages: EliminationStagePlan[] = planEliminationStages(active.length, config);
    const math = computeParticipationMath(active.length, config.maxPhysicalTables);
    const qualifyingRoundsCount = stages.filter((s) => s.phase === 'qualifying').length;
    const plannedRounds = stages.length;

    const plannedByesByRound = scheduleByes(
      active,
      qualifyingRoundsCount,
      config.maxPhysicalTables,
      seed
    );
    // Elimination and Final rounds have 0 byes (exact multiples of 4)
    for (const stage of stages) {
      if (stage.phase !== 'qualifying') {
        plannedByesByRound[stage.roundNumber] = [];
      }
    }

    const firstRoundPreviewBase = generateRound({
      roundNumber: 1,
      activeParticipants: active,
      plannedByes: plannedByesByRound[1] ?? [],
      futurePlannedByesByRound: plannedByesByRound,
      history: createEmptyHistory(active),
      standings: [],
      config,
      seed
    });

    const firstRoundPreview: GeneratedRound = {
      ...firstRoundPreviewBase,
      phase: stages[0]!.phase,
      stageName: stages[0]!.stageName
    };

    const minutesPerRound = Math.round(config.roundDurationSeconds / 60);
    const estimatedDurationMinutes =
      plannedRounds * minutesPerRound +
      Math.max(0, plannedRounds - 1) * config.transitionMinutesBetweenRounds;

    const equalGamesInQualifying = math.byesPerRound === 0;
    const rankingMode: RankingMode = equalGamesInQualifying ? 'equal_games' : 'unequal_games';

    const stageChainText = stages
      .map((s) => `${s.stageName} (${s.expectedParticipants} jug., ${s.tablesCount} ${s.tablesCount === 1 ? 'mesa' : 'mesas'})`)
      .join(' → ');

    const explanations: string[] = [
      `Modalidad seleccionada: Clasificatoria con eliminaciones hasta la Final (${plannedRounds} rondas, ~${estimatedDurationMinutes} min).`,
      `Estructura de fases: ${stageChainText}.`,
      math.byesPerRound === 0
        ? `Con ${active.length} jugadores se forman ${math.tablesPerRound} mesas exactas sin descansos en todas las fases.`
        : `En Ronda 1 descansan ${math.byesPerRound} ${
            math.byesPerRound === 1 ? 'jugador elegido' : 'jugadores elegidos'
          } al azar con pase libre a Ronda 2; en Ronda 2 juegan obligatoriamente y los descansos de Ronda 2 se asignan prioritariamente a ganadores de Ronda 1 para no dejar sin segunda partida a quienes perdieron en Ronda 1 antes del corte a ${
            stages[2]!.expectedParticipants
          } jugadores. A partir de esa fase todas las mesas son exactas sin descansos.`,
      'La Gran Final se decide en 1 sola partida de 4 finalistas: se proclama la Pareja Ganadora de la Final y el Campeón Individual entre sus dos integrantes según rendimiento acumulado.'
    ];

    const warnings: string[] = [];
    if (math.maxPossibleTables > math.tablesPerRound) {
      warnings.push(
        `Existe un límite físico de ${math.tablesPerRound} mesas configurado para la clasificatoria.`
      );
    }

    const syntheticRoundPlan: RoundPlanRecommendation = {
      math,
      recommendedRounds: plannedRounds,
      selectedRounds: plannedRounds,
      equalGamesAchieved: equalGamesInQualifying,
      minGamesPerPlayer: equalGamesInQualifying ? qualifyingRoundsCount : qualifyingRoundsCount - 1,
      maxGamesPerPlayer: plannedRounds,
      minByesPerPlayer: 0,
      maxByesPerPlayer: equalGamesInQualifying ? 0 : 1,
      rankingMode,
      estimatedDurationMinutes,
      candidates: [],
      explanations,
      warnings
    };

    const rulesDocument = generateTournamentRules(syntheticRoundPlan, config, stages);

    return {
      seed,
      format: 'qualifying_elimination',
      config,
      availableFormats,
      participantCount: active.length,
      tablesPerRound: math.tablesPerRound,
      activePerRound: math.activePerRound,
      byesPerRound: math.byesPerRound,
      recommendedRounds: plannedRounds,
      selectedRounds: plannedRounds,
      equalGamesAchieved: equalGamesInQualifying,
      minGamesPerPlayer: syntheticRoundPlan.minGamesPerPlayer,
      maxGamesPerPlayer: plannedRounds,
      minByesPerPlayer: 0,
      maxByesPerPlayer: equalGamesInQualifying ? 0 : 1,
      rankingMode,
      estimatedDurationMinutes,
      eliminationStages: stages,
      plannedByesByRound,
      firstRoundPreview,
      fixedSchedulePreview: null, // Elimination rounds depend dynamically on who advances
      rulesDocument,
      explanations,
      warnings
    };
  }

  // Format: rounds_all_play (N is strictly a multiple of 4 -> 0 byes unless physical table cap)
  const roundPlan = planRoundCount(active.length, config, input.overrideRounds);
  const plannedByesByRound = scheduleByes(
    active,
    roundPlan.selectedRounds,
    config.maxPhysicalTables,
    seed
  );

  const firstRoundPreviewBase = generateRound({
    roundNumber: 1,
    activeParticipants: active,
    plannedByes: plannedByesByRound[1] ?? [],
    futurePlannedByesByRound: plannedByesByRound,
    history: createEmptyHistory(active),
    standings: [],
    config,
    seed
  });

  const firstRoundPreview: GeneratedRound = {
    ...firstRoundPreviewBase,
    phase: 'regular',
    stageName: 'Ronda 1'
  };

  let fixedSchedulePreview: GeneratedRound[] | null = null;
  if (config.schedulingMode === 'fixed_schedule') {
    const generatedRounds: GeneratedRound[] = [firstRoundPreview];
    for (let r = 2; r <= roundPlan.selectedRounds; r++) {
      const history = buildTournamentHistory(active, generatedRounds);
      const nextRound = generateRound({
        roundNumber: r,
        activeParticipants: active,
        plannedByes: plannedByesByRound[r] ?? [],
        futurePlannedByesByRound: plannedByesByRound,
        history,
        standings: [],
        config,
        seed
      });
      generatedRounds.push({
        ...nextRound,
        phase: 'regular',
        stageName: `Ronda ${r}`
      });
    }
    fixedSchedulePreview = generatedRounds;
  }

  const rulesDocument = generateTournamentRules(roundPlan, config, null);

  return {
    seed,
    format: 'rounds_all_play',
    config,
    availableFormats,
    participantCount: roundPlan.math.participantCount,
    tablesPerRound: roundPlan.math.tablesPerRound,
    activePerRound: roundPlan.math.activePerRound,
    byesPerRound: roundPlan.math.byesPerRound,
    recommendedRounds: roundPlan.recommendedRounds,
    selectedRounds: roundPlan.selectedRounds,
    equalGamesAchieved: roundPlan.equalGamesAchieved,
    minGamesPerPlayer: roundPlan.minGamesPerPlayer,
    maxGamesPerPlayer: roundPlan.maxGamesPerPlayer,
    minByesPerPlayer: roundPlan.minByesPerPlayer,
    maxByesPerPlayer: roundPlan.maxByesPerPlayer,
    rankingMode: roundPlan.rankingMode,
    estimatedDurationMinutes: roundPlan.estimatedDurationMinutes,
    eliminationStages: null,
    plannedByesByRound,
    firstRoundPreview,
    fixedSchedulePreview,
    rulesDocument,
    explanations: roundPlan.explanations,
    warnings: roundPlan.warnings
  };
}
