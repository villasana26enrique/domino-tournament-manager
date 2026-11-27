import type {
  CompletedRound,
  FairnessMetrics,
  GeneratedMatch,
  GeneratedRound,
  PairRepeatDetail,
  Participant,
  StandingRow,
  TournamentFairnessSummary,
  TournamentHistory
} from '../domain/types.js';
import { buildTournamentHistory, makePairKey } from './history.js';

export function evaluateRoundFairness(input: {
  roundNumber: number;
  matches: readonly GeneratedMatch[];
  byes: readonly string[];
  activeParticipants: readonly Participant[];
  historyBeforeRound: TournamentHistory;
  standingsBeforeRound: readonly StandingRow[];
  allHardConstraintsSatisfied: boolean;
}): FairnessMetrics {
  const {
    roundNumber,
    matches,
    byes,
    activeParticipants,
    historyBeforeRound,
    standingsBeforeRound,
    allHardConstraintsSatisfied
  } = input;

  let repeatedPartnersInRound = 0;
  let repeatedOpponentsInRound = 0;

  const nextPartnerCounts = new Map(historyBeforeRound.partnerCounts);
  const nextOpponentCounts = new Map(historyBeforeRound.opponentCounts);
  const nextByesByPlayer = new Map(historyBeforeRound.byesByPlayer);

  for (const match of matches) {
    const [a1, a2] = match.pairA;
    const [b1, b2] = match.pairB;

    const pKeyA = makePairKey(a1, a2);
    const pKeyB = makePairKey(b1, b2);
    if ((historyBeforeRound.partnerCounts.get(pKeyA) ?? 0) > 0) repeatedPartnersInRound += 1;
    if ((historyBeforeRound.partnerCounts.get(pKeyB) ?? 0) > 0) repeatedPartnersInRound += 1;
    nextPartnerCounts.set(pKeyA, (nextPartnerCounts.get(pKeyA) ?? 0) + 1);
    nextPartnerCounts.set(pKeyB, (nextPartnerCounts.get(pKeyB) ?? 0) + 1);

    const oppKeys = [
      makePairKey(a1, b1),
      makePairKey(a1, b2),
      makePairKey(a2, b1),
      makePairKey(a2, b2)
    ];
    for (const oKey of oppKeys) {
      if ((historyBeforeRound.opponentCounts.get(oKey) ?? 0) > 0) repeatedOpponentsInRound += 1;
      nextOpponentCounts.set(oKey, (nextOpponentCounts.get(oKey) ?? 0) + 1);
    }
  }

  let consecutiveByesCount = 0;
  for (const byeId of byes) {
    if (historyBeforeRound.lastByeRoundByPlayer.get(byeId) === roundNumber - 1) {
      consecutiveByesCount += 1;
    }
    nextByesByPlayer.set(byeId, (nextByesByPlayer.get(byeId) ?? 0) + 1);
  }

  let cumulativeMaxPartnerRepeats = 0;
  for (const count of nextPartnerCounts.values()) {
    if (count > 1) {
      cumulativeMaxPartnerRepeats = Math.max(cumulativeMaxPartnerRepeats, count - 1);
    }
  }

  let cumulativeMaxOpponentRepeats = 0;
  for (const count of nextOpponentCounts.values()) {
    if (count > 1) {
      cumulativeMaxOpponentRepeats = Math.max(cumulativeMaxOpponentRepeats, count - 1);
    }
  }

  const activeByeCounts = activeParticipants.map((p) => nextByesByPlayer.get(p.id) ?? 0);
  const cumulativeByeSpread =
    activeByeCounts.length > 0
      ? Math.max(...activeByeCounts) - Math.min(...activeByeCounts)
      : 0;

  let competitiveSpreadAvg = 0;
  if (standingsBeforeRound.length > 0 && matches.length > 0) {
    const rankMap = new Map<string, number>();
    standingsBeforeRound.forEach((row, idx) => rankMap.set(row.participantId, idx + 1));

    let spreadSum = 0;
    for (const m of matches) {
      const ranks = [...m.pairA, ...m.pairB].map((id) => rankMap.get(id) ?? 1);
      spreadSum += Math.max(...ranks) - Math.min(...ranks);
    }
    competitiveSpreadAvg = Number((spreadSum / matches.length).toFixed(2));
  }

  return {
    repeatedPartnersInRound,
    repeatedOpponentsInRound,
    cumulativeMaxPartnerRepeats,
    cumulativeMaxOpponentRepeats,
    cumulativeByeSpread,
    consecutiveByesCount,
    competitiveSpreadAvg,
    allHardConstraintsSatisfied
  };
}

export function summarizeTournamentFairness(
  participants: readonly Participant[],
  rounds: readonly (GeneratedRound | CompletedRound)[]
): TournamentFairnessSummary {
  const history = buildTournamentHistory(participants, rounds);

  const byesByPlayer: Record<string, number> = {};
  const gamesByPlayer: Record<string, number> = {};

  const sortedParticipants = [...participants].sort((a, b) => a.number - b.number);
  for (const p of sortedParticipants) {
    byesByPlayer[p.id] = history.byesByPlayer.get(p.id) ?? 0;
    gamesByPlayer[p.id] = history.gamesByPlayer.get(p.id) ?? 0;
  }

  const repeatedPartnerPairs: PairRepeatDetail[] = [];
  let partnerExcess = 0;
  let maxPartnerCount = 0;
  for (const [key, count] of history.partnerCounts.entries()) {
    if (count > maxPartnerCount) maxPartnerCount = count;
    if (count > 1) {
      partnerExcess += count - 1;
      const [p1, p2] = key.split('::') as [string, string];
      repeatedPartnerPairs.push({ players: [p1, p2], count });
    }
  }
  repeatedPartnerPairs.sort((a, b) => b.count - a.count || a.players[0].localeCompare(b.players[0]));

  const repeatedOpponentPairs: PairRepeatDetail[] = [];
  let opponentExcess = 0;
  let maxOpponentCount = 0;
  for (const [key, count] of history.opponentCounts.entries()) {
    if (count > maxOpponentCount) maxOpponentCount = count;
    if (count > 1) {
      opponentExcess += count - 1;
      const [p1, p2] = key.split('::') as [string, string];
      repeatedOpponentPairs.push({ players: [p1, p2], count });
    }
  }
  repeatedOpponentPairs.sort(
    (a, b) => b.count - a.count || a.players[0].localeCompare(b.players[0])
  );

  // Count consecutive byes across sorted rounds
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  let consecutiveByesCount = 0;
  let prevByes = new Set<string>();
  for (const round of sortedRounds) {
    for (const byeId of round.byes) {
      if (prevByes.has(byeId)) {
        consecutiveByesCount += 1;
      }
    }
    prevByes = new Set(round.byes);
  }

  const activeByes = sortedParticipants
    .filter((p) => p.status === 'active')
    .map((p) => byesByPlayer[p.id] ?? 0);
  const maxByeSpread =
    activeByes.length > 0 ? Math.max(...activeByes) - Math.min(...activeByes) : 0;

  return {
    byesByPlayer,
    gamesByPlayer,
    repeatedPartners: {
      totalExcessRepeats: partnerExcess,
      maxPairCount: maxPartnerCount,
      pairs: repeatedPartnerPairs
    },
    repeatedOpponents: {
      totalExcessRepeats: opponentExcess,
      maxOpponentCount: maxOpponentCount,
      pairs: repeatedOpponentPairs
    },
    consecutiveByesCount,
    maxByeSpread
  };
}
