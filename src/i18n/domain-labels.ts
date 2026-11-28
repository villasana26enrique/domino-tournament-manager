import {
  generateTournamentRules,
  type EliminationStagePlan,
  type FormatAvailability,
  type RoundPlanRecommendation,
  type StructuredRulesDocument,
  type TournamentConfig
} from '../core/index.js';
import type { Locale } from './locale.js';

export function localizeStageName(stageName: string, locale: Locale): string {
  if (locale === 'es') return stageName;
  if (stageName === 'Clasificatoria 1') return 'Qualifying Round 1';
  if (stageName === 'Clasificatoria 2 (Corte)') return 'Qualifying Round 2 (Cut)';
  if (stageName === 'Cuartos de Final') return 'Quarterfinals';
  if (stageName === 'Semifinal') return 'Semifinals';
  if (stageName === 'Gran Final') return 'Grand Final';

  const roundMatch = /^Ronda (\d+)$/.exec(stageName);
  if (roundMatch) {
    return `Round ${roundMatch[1]}`;
  }
  const topMatch = /^Eliminatoria Top (\d+)$/.exec(stageName);
  if (topMatch) {
    return `Knockout Top ${topMatch[1]}`;
  }
  return stageName;
}

export function localizeRuntimeLabel(runtimeLabel: string, locale: Locale): string {
  if (locale === 'en') {
    if (runtimeLabel.includes('SQLite')) return 'Local SQLite (Desktop)';
    if (runtimeLabel.includes('pruebas') || runtimeLabel.includes('Test')) return 'Test environment';
    return 'Local browser storage';
  }
  if (runtimeLabel.includes('SQLite')) return 'SQLite local (Desktop)';
  if (runtimeLabel.includes('pruebas')) return 'Entorno de pruebas';
  return 'Guardado local en navegador';
}

export function localizeFormatAvailability(
  option: FormatAvailability,
  participantCount: number,
  locale: Locale
): FormatAvailability {
  if (locale === 'es') return option;

  const isMultipleOf4 = participantCount % 4 === 0;
  const lowerMultiple = Math.floor(participantCount / 4) * 4;
  const upperMultiple = lowerMultiple + 4;
  const missingForUp = upperMultiple - participantCount;
  const excessForDown = participantCount - lowerMultiple;

  if (option.format === 'rounds_all_play') {
    return {
      ...option,
      title: 'Fixed Rounds (Everyone Plays All Rounds)',
      reason: isMultipleOf4
        ? `With ${participantCount} players, ${participantCount / 4} exact tables run with 0 byes: everyone plays all rounds.`
        : `Only available for multiples of 4 to prevent bye disadvantages. With ${participantCount} players, ${excessForDown} extra (for ${lowerMultiple}) or ${missingForUp} more needed (for ${upperMultiple}).`
    };
  }

  return {
    ...option,
    title: 'Qualifying + Knockouts to the Grand Final',
    reason: isMultipleOf4
      ? 'Two qualifying rounds followed by exact multiple-of-4 knockouts down to a 4-player Grand Final.'
      : `Recommended for ${participantCount} players: short qualifying (random R1 free pass for resting players) followed by exact knockout rounds with zero byes to the Grand Final.`
  };
}

export function localizePlanExplanations(
  explanations: readonly string[],
  locale: Locale
): string[] {
  if (locale === 'es') return [...explanations];

  return explanations.map((line) => {
    if (line.startsWith('Modalidad seleccionada:')) {
      return 'Selected format: Qualifying + Knockouts to the Grand Final (fair 2-round qualifier followed by exact multiple-of-4 knockouts).';
    }
    if (line.startsWith('Estructura de fases:')) {
      return line
        .replace('Estructura de fases:', 'Stage progression:')
        .replaceAll('Clasificatoria 1', 'Qualifying Round 1')
        .replaceAll('Clasificatoria 2 (Corte)', 'Qualifying Round 2 (Cut)')
        .replaceAll('Cuartos de Final', 'Quarterfinals')
        .replaceAll('Semifinal', 'Semifinals')
        .replaceAll('Gran Final', 'Grand Final')
        .replaceAll(' jug.,', 'p,')
        .replaceAll(' mesas)', ' tables)')
        .replaceAll(' mesa)', ' table)');
    }
    if (line.startsWith('En Ronda 1 descansan')) {
      return 'In Qualifying Round 1, resting players receive a free pass to Round 2; in Round 2 they play obligatorily and R2 byes prioritize Round 1 winners so no R1 loser misses their second qualifying game.';
    }
    if (line.startsWith('Con ')) {
      return 'Exact tables across all stages with zero byes.';
    }
    if (line.startsWith('La Gran Final se decide')) {
      return 'The Grand Final is decided in 1 decisive match of 4 finalists: crowning the Winning Final Pair and the Individual Champion.';
    }
    if (line.startsWith('Duración estimada:')) {
      return 'Estimated duration includes round time and transitions between rounds.';
    }
    return line;
  });
}

export function localizeRulesDocument(
  snapshot: StructuredRulesDocument,
  config: TournamentConfig,
  eliminationStages: readonly EliminationStagePlan[] | null,
  locale: Locale
): StructuredRulesDocument {
  if (locale === 'es') return snapshot;

  const p = snapshot.parameters;
  const syntheticPlan: RoundPlanRecommendation = {
    math: {
      participantCount: p.participantCount,
      tablesPerRound: p.tablesPerRound,
      activePerRound: p.tablesPerRound * 4,
      byesPerRound: p.byesPerRound,
      maxPossibleTables: Math.floor(p.participantCount / 4),
      minEqualRounds: 1,
      consecutiveByesUnavoidable: false
    },
    recommendedRounds: p.plannedRounds,
    selectedRounds: p.plannedRounds,
    equalGamesAchieved: p.equalGamesAchieved,
    minGamesPerPlayer: p.minGamesPerPlayer,
    maxGamesPerPlayer: p.maxGamesPerPlayer,
    minByesPerPlayer: 0,
    maxByesPerPlayer: p.equalGamesAchieved ? 0 : 1,
    rankingMode: p.rankingMode,
    estimatedDurationMinutes: p.estimatedDurationMinutes,
    candidates: [],
    explanations: [],
    warnings: []
  };

  return generateTournamentRules(syntheticPlan, config, eliminationStages, locale);
}

export function localizePinError(err: string | null, locale: Locale): string | null {
  if (!err || locale === 'es') return err;
  return 'PIN must be 4 to 6 numeric digits (no spaces or letters).';
}

export function localizeScoreMessages(messages: readonly string[], locale: Locale): string[] {
  if (locale === 'es') return [...messages];
  return messages.map((msg) => {
    if (msg.includes('empate') && msg.includes('objetivo')) {
      return 'A match ending by target score cannot end in a tie.';
    }
    if (msg.includes('ambas parejas') || msg.includes('no pueden alcanzar')) {
      return 'Both pairs cannot reach or exceed the target score in the same domino match.';
    }
    if (msg.includes('negativo') || msg.includes('enteros')) {
      return 'Scores must be non-negative whole numbers.';
    }
    if (msg.includes('ninguna pareja alcanzó')) {
      return 'Notice: neither pair reached the target score under target-score mode. Confirm if correct or switch end reason to Time Expired.';
    }
    if (msg.includes('inusualmente alto')) {
      return 'Notice: score looks unusually high for a single domino match. Double check before confirming.';
    }
    return msg;
  });
}
