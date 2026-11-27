import type {
  EliminationStagePlan,
  FairnessMetrics,
  FinalChampionSummary,
  MatchEndReason,
  MatchOutcome,
  PairSide,
  Participant,
  RoundPhase,
  RoundStatus,
  StructuredRulesDocument,
  TournamentConfig,
  TournamentStatus
} from '../../core/index.js';

export interface PersistedMatch {
  id: string;
  tableNumber: number;
  pairA: [string, string];
  pairB: [string, string];
  status: 'pending' | 'completed';
  pairAScore: number | null;
  pairBScore: number | null;
  winnerPair: PairSide | null;
  outcome: MatchOutcome | null;
  endedBy: MatchEndReason | null;
  recordedAt: string | null;
}

export interface PersistedRound {
  id: string;
  roundNumber: number;
  phase: RoundPhase;
  stageName: string;
  status: RoundStatus;
  durationSeconds: number;
  elapsedBeforeRunMs: number;
  timerStartedAtUtcMs: number | null;
  warningFiredAtUtcMs: number | null;
  expiredFiredAtUtcMs: number | null;
  matches: PersistedMatch[];
  byes: string[];
  eliminatedParticipantIds: string[];
  metrics: FairnessMetrics;
  explanations: string[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface ResultAuditLog {
  id: string;
  roundNumber: number;
  matchId: string;
  tableNumber: number;
  action: 'recorded' | 'corrected';
  prevPairAScore: number | null;
  prevPairBScore: number | null;
  newPairAScore: number;
  newPairBScore: number;
  reason: string | null;
  createdAt: string;
}

export interface TournamentRecord {
  id: string;
  name: string;
  status: TournamentStatus;
  seed: string;
  config: TournamentConfig;
  overrideRounds: number | null;
  plannedRounds: number;
  currentRoundNumber: number;
  participants: Participant[];
  plannedByesByRound: Record<number, string[]>;
  eliminationStages: EliminationStagePlan[] | null;
  ruleSnapshot: StructuredRulesDocument | null;
  rounds: PersistedRound[];
  resultAuditLogs: ResultAuditLog[];
  finalChampion: FinalChampionSummary | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface TournamentRepository {
  save(record: TournamentRecord): Promise<void>;
  getById(id: string): Promise<TournamentRecord | null>;
  list(): Promise<TournamentRecord[]>;
  delete(id: string): Promise<void>;
}
