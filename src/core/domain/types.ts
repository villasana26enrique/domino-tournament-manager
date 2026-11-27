export type TournamentFormat = 'rounds_all_play' | 'qualifying_elimination';

export type RoundPhase = 'regular' | 'qualifying' | 'elimination' | 'final';

export type TournamentStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type RoundStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'time_expired'
  | 'recording_results'
  | 'completed';

export type SchedulingMode = 'hybrid_competitive' | 'fixed_schedule';

export type RankingMode = 'equal_games' | 'unequal_games';

export type RoundPlanningMode = 'recommended_duration' | 'strict_equality';

export type PairSide = 'A' | 'B';

export type MatchOutcome = 'pair_a_win' | 'pair_b_win' | 'draw';

export type MatchEndReason = 'target_score' | 'time_expired' | 'admin_override';

export type TieResolutionRule = 'allow_draw_on_time';

export type FinalTieBreakerRule = 'playoff_match' | 'shared_title';

export interface TournamentConfig {
  format: TournamentFormat;
  targetScore: number;
  roundDurationSeconds: number;
  warningBeforeEndSeconds: number;
  maxPhysicalTables: number | null;
  tieResolutionRule: TieResolutionRule;
  finalTieBreaker: FinalTieBreakerRule;
  schedulingMode: SchedulingMode;
  roundPlanningMode: RoundPlanningMode;
  allowCompetitivePairing: boolean;
  transitionMinutesBetweenRounds: number;
}

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  format: 'rounds_all_play',
  targetScore: 100,
  roundDurationSeconds: 1500,
  warningBeforeEndSeconds: 300,
  maxPhysicalTables: null,
  tieResolutionRule: 'allow_draw_on_time',
  finalTieBreaker: 'playoff_match',
  schedulingMode: 'hybrid_competitive',
  roundPlanningMode: 'recommended_duration',
  allowCompetitivePairing: true,
  transitionMinutesBetweenRounds: 5
};

export interface FormatAvailability {
  format: TournamentFormat;
  title: string;
  available: boolean;
  recommended: boolean;
  reason: string;
}

export interface EliminationStagePlan {
  roundNumber: number;
  phase: RoundPhase;
  stageName: string;
  expectedParticipants: number;
  tablesCount: number;
  byesCount: number;
  advancesCount: number;
}

export interface Participant {
  id: string;
  playerId: string;
  number: number;
  displayName: string;
  status: 'active' | 'withdrawn' | 'eliminated';
  withdrawnAfterRound: number | null;
  eliminatedAfterRound?: number | null;
  isSubstitute?: boolean;
  substitutedForName?: string | null;
}

export interface ParticipationMath {
  participantCount: number;
  maxPossibleTables: number;
  tablesPerRound: number;
  activePerRound: number;
  byesPerRound: number;
  minEqualRounds: number;
  consecutiveByesUnavoidable: boolean;
}

export interface RoundCandidateEvaluation {
  rounds: number;
  equalGames: boolean;
  minGamesPerPlayer: number;
  maxGamesPerPlayer: number;
  minByesPerPlayer: number;
  maxByesPerPlayer: number;
  estimatedDurationMinutes: number;
  forcesPartnerRepeats: boolean;
  score: number;
  rationale: string;
}

export interface RoundPlanRecommendation {
  math: ParticipationMath;
  recommendedRounds: number;
  selectedRounds: number;
  equalGamesAchieved: boolean;
  minGamesPerPlayer: number;
  maxGamesPerPlayer: number;
  minByesPerPlayer: number;
  maxByesPerPlayer: number;
  rankingMode: RankingMode;
  estimatedDurationMinutes: number;
  candidates: RoundCandidateEvaluation[];
  explanations: string[];
  warnings: string[];
}

export interface GeneratedMatch {
  tableNumber: number;
  pairA: [string, string];
  pairB: [string, string];
}

export interface RecordedMatch extends GeneratedMatch {
  matchId: string;
  roundNumber: number;
  status: 'completed';
  pairAScore: number;
  pairBScore: number;
  winnerPair: PairSide | null;
  outcome: MatchOutcome;
  endedBy: MatchEndReason;
}

export interface FairnessMetrics {
  repeatedPartnersInRound: number;
  repeatedOpponentsInRound: number;
  cumulativeMaxPartnerRepeats: number;
  cumulativeMaxOpponentRepeats: number;
  cumulativeByeSpread: number;
  consecutiveByesCount: number;
  competitiveSpreadAvg: number;
  allHardConstraintsSatisfied: boolean;
}

export interface GeneratedRound {
  roundNumber: number;
  phase?: RoundPhase;
  stageName?: string;
  matches: GeneratedMatch[];
  byes: string[];
  metrics: FairnessMetrics;
  explanations: string[];
}

export interface CompletedRound {
  roundNumber: number;
  phase?: RoundPhase;
  stageName?: string;
  matches: RecordedMatch[];
  byes: string[];
  eliminatedParticipantIds?: string[];
  metrics: FairnessMetrics;
  explanations: string[];
}

export interface TournamentHistory {
  completedRoundsCount: number;
  partnerCounts: Map<string, number>;
  opponentCounts: Map<string, number>;
  tableCounts: Map<string, number>;
  byesByPlayer: Map<string, number>;
  gamesByPlayer: Map<string, number>;
  lastByeRoundByPlayer: Map<string, number>;
}

export interface StandingRow {
  rank: number;
  isTied: boolean;
  participantId: string;
  participantNumber: number;
  displayName: string;
  status: 'active' | 'withdrawn' | 'eliminated';
  isSubstitute?: boolean;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  matchPoints: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  avgPointDiff: number;
  avgPointsFor: number;
  byes: number;
}

export interface FinalChampionSummary {
  individualChampion: StandingRow;
  winningPair: [StandingRow, StandingRow];
  finalMatch: RecordedMatch;
  decidedByTieBreak: boolean;
}

export interface StructuredRuleSection {
  id: string;
  title: string;
  items: string[];
}

export interface StructuredRulesDocument {
  version: string;
  modality: 'individual_rotating_pairs';
  format: TournamentFormat;
  modalityTitle: string;
  summary: string;
  parameters: {
    format: TournamentFormat;
    participantCount: number;
    tablesPerRound: number;
    byesPerRound: number;
    plannedRounds: number;
    roundDurationMinutes: number;
    warningMinutesBeforeEnd: number;
    targetScore: number;
    estimatedDurationMinutes: number;
    equalGamesAchieved: boolean;
    minGamesPerPlayer: number;
    maxGamesPerPlayer: number;
    rankingMode: RankingMode;
    schedulingMode: SchedulingMode;
    tieResolutionRule: TieResolutionRule;
    finalTieBreaker: FinalTieBreakerRule;
  };
  sections: StructuredRuleSection[];
  renderedMarkdown: string;
}

export interface TournamentPlan {
  seed: string;
  format: TournamentFormat;
  config: TournamentConfig;
  availableFormats: FormatAvailability[];
  participantCount: number;
  tablesPerRound: number;
  activePerRound: number;
  byesPerRound: number;
  recommendedRounds: number;
  selectedRounds: number;
  equalGamesAchieved: boolean;
  minGamesPerPlayer: number;
  maxGamesPerPlayer: number;
  minByesPerPlayer: number;
  maxByesPerPlayer: number;
  rankingMode: RankingMode;
  estimatedDurationMinutes: number;
  eliminationStages: EliminationStagePlan[] | null;
  plannedByesByRound: Record<number, string[]>;
  firstRoundPreview: GeneratedRound;
  fixedSchedulePreview: GeneratedRound[] | null;
  rulesDocument: StructuredRulesDocument;
  explanations: string[];
  warnings: string[];
}

export interface ConstraintViolation {
  code: string;
  roundNumber?: number;
  tableNumber?: number;
  message: string;
}

export interface ScoreValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  winnerPair: PairSide | null;
  outcome: MatchOutcome | null;
}

export interface PairRepeatDetail {
  players: [string, string];
  count: number;
}

export interface TournamentFairnessSummary {
  byesByPlayer: Record<string, number>;
  gamesByPlayer: Record<string, number>;
  repeatedPartners: {
    totalExcessRepeats: number;
    maxPairCount: number;
    pairs: PairRepeatDetail[];
  };
  repeatedOpponents: {
    totalExcessRepeats: number;
    maxOpponentCount: number;
    pairs: PairRepeatDetail[];
  };
  consecutiveByesCount: number;
  maxByeSpread: number;
}

export interface SimulationRoundReport {
  roundNumber: number;
  phase: RoundPhase;
  stageName: string;
  byes: string[];
  eliminatedParticipantIds: string[];
  matches: Array<{
    tableNumber: number;
    pairA: [string, string];
    pairB: [string, string];
    pairAScore: number;
    pairBScore: number;
    winnerPair: PairSide | null;
    outcome: MatchOutcome;
    endedBy: MatchEndReason;
  }>;
  metrics: FairnessMetrics;
  explanations: string[];
}

export interface SimulationReport {
  schemaVersion: '1.1.0';
  format: TournamentFormat;
  seed: string;
  config: TournamentConfig;
  participantCount: number;
  plannedRounds: number;
  tablesPerRound: number;
  byesPerRound: number;
  rankingMode: RankingMode;
  equalGamesAchieved: boolean;
  executionTimeMs: number;
  stages: EliminationStagePlan[] | null;
  rulesSnapshot: StructuredRulesDocument;
  rounds: SimulationRoundReport[];
  summary: TournamentFairnessSummary;
  finalStandings: StandingRow[];
  finalChampion: FinalChampionSummary | null;
  constraintViolations: ConstraintViolation[];
}
