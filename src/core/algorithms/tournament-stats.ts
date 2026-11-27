import type {
  CompletedRound,
  Participant,
  StandingRow
} from '../domain/types.js';
import { summarizeTournamentFairness } from './fairness-evaluator.js';

export interface TournamentStatistics {
  totalMatches: number;
  totalPointsScored: number;
  drawsCount: number;
  repeatedPartnersCount: number;
  repeatedOpponentsCount: number;
  highestMatchScore: {
    roundNumber: number;
    tableNumber: number;
    score: number;
    loserScore: number;
  } | null;
  largestVictoryMargin: {
    roundNumber: number;
    tableNumber: number;
    margin: number;
    winnerScore: number;
    loserScore: number;
  } | null;
  topScorer: StandingRow | null;
  bestDifferential: StandingRow | null;
}

export function computeTournamentStats(
  participants: readonly Participant[],
  completedRounds: readonly CompletedRound[],
  standings: readonly StandingRow[]
): TournamentStatistics {
  let totalMatches = 0;
  let totalPointsScored = 0;
  let drawsCount = 0;

  let highestMatchScore: TournamentStatistics['highestMatchScore'] = null;
  let largestVictoryMargin: TournamentStatistics['largestVictoryMargin'] = null;

  for (const round of completedRounds) {
    for (const match of round.matches) {
      if (match.status !== 'completed') continue;
      totalMatches += 1;
      totalPointsScored += match.pairAScore + match.pairBScore;

      if (match.outcome === 'draw') {
        drawsCount += 1;
      }

      const maxScore = Math.max(match.pairAScore, match.pairBScore);
      const minScore = Math.min(match.pairAScore, match.pairBScore);
      const margin = maxScore - minScore;

      if (!highestMatchScore || maxScore > highestMatchScore.score) {
        highestMatchScore = {
          roundNumber: round.roundNumber,
          tableNumber: match.tableNumber,
          score: maxScore,
          loserScore: minScore
        };
      }

      if (margin > 0 && (!largestVictoryMargin || margin > largestVictoryMargin.margin)) {
        largestVictoryMargin = {
          roundNumber: round.roundNumber,
          tableNumber: match.tableNumber,
          margin,
          winnerScore: maxScore,
          loserScore: minScore
        };
      }
    }
  }

  const fairness = summarizeTournamentFairness(participants, completedRounds);

  const activeOrPlayed = standings.filter((s) => s.gamesPlayed > 0);
  const topScorer =
    activeOrPlayed.length > 0
      ? [...activeOrPlayed].sort(
          (a, b) => b.pointsFor - a.pointsFor || a.participantNumber - b.participantNumber
        )[0]!
      : null;

  const bestDifferential =
    activeOrPlayed.length > 0
      ? [...activeOrPlayed].sort(
          (a, b) => b.pointDiff - a.pointDiff || a.participantNumber - b.participantNumber
        )[0]!
      : null;

  return {
    totalMatches,
    totalPointsScored,
    drawsCount,
    repeatedPartnersCount: fairness.repeatedPartners.totalExcessRepeats,
    repeatedOpponentsCount: fairness.repeatedOpponents.totalExcessRepeats,
    highestMatchScore,
    largestVictoryMargin,
    topScorer,
    bestDifferential
  };
}
