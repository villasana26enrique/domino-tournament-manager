import type {
  CompletedRound,
  Participant,
  RankingMode,
  StandingRow
} from '../domain/types.js';

interface MutableStats {
  participant: Participant;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  byes: number;
  /** Net wins minus losses against a specific opponent id */
  headToHeadNet: Map<string, number>;
}

const EPSILON = 1e-9;

function compareDesc(a: number, b: number): number {
  if (Math.abs(a - b) <= EPSILON) return 0;
  return b - a;
}

function compareAsc(a: number, b: number): number {
  if (Math.abs(a - b) <= EPSILON) return 0;
  return a - b;
}

function comparePrimaryMetrics(a: StandingRow, b: StandingRow, mode: RankingMode): number {
  if (mode === 'equal_games') {
    const byMatchPts = compareDesc(a.matchPoints, b.matchPoints);
    if (byMatchPts !== 0) return byMatchPts;

    const byWins = compareDesc(a.wins, b.wins);
    if (byWins !== 0) return byWins;

    const byDiff = compareDesc(a.pointDiff, b.pointDiff);
    if (byDiff !== 0) return byDiff;

    const byPF = compareDesc(a.pointsFor, b.pointsFor);
    if (byPF !== 0) return byPF;

    return compareAsc(a.losses, b.losses);
  }

  // unequal_games (ADR-003):
  // 1. Effectiveness rate: (W + 0.5*D) / GP
  // 2. Total matchPoints: W + 0.5*D (resolves 5-0 vs 4-0+bye at 100%)
  // 3. Total wins (prefers outright victories over draws)
  // 4. Average point differential per game
  // 5. Average points for per game
  // 6. Fewer losses
  const byWinRate = compareDesc(a.winRate, b.winRate);
  if (byWinRate !== 0) return byWinRate;

  const byMatchPts = compareDesc(a.matchPoints, b.matchPoints);
  if (byMatchPts !== 0) return byMatchPts;

  const byWins = compareDesc(a.wins, b.wins);
  if (byWins !== 0) return byWins;

  const byAvgDiff = compareDesc(a.avgPointDiff, b.avgPointDiff);
  if (byAvgDiff !== 0) return byAvgDiff;

  const byAvgPF = compareDesc(a.avgPointsFor, b.avgPointsFor);
  if (byAvgPF !== 0) return byAvgPF;

  return compareAsc(a.losses, b.losses);
}

/**
 * Pure, deterministic standings calculation from confirmed match results.
 * Supports wins, time-expired draws (0.5 matchPoint, no winner/loser), and losses.
 * Always recalculates from scratch to prevent cumulative drift or duplicate updates.
 */
export function calculateStandings(input: {
  participants: readonly Participant[];
  completedRounds: readonly CompletedRound[];
  rankingMode: RankingMode;
}): StandingRow[] {
  const { participants, completedRounds, rankingMode } = input;

  const statsMap = new Map<string, MutableStats>();
  for (const p of participants) {
    statsMap.set(p.id, {
      participant: p,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      byes: 0,
      headToHeadNet: new Map<string, number>()
    });
  }

  for (const round of completedRounds) {
    for (const byeId of round.byes) {
      const s = statsMap.get(byeId);
      if (s) s.byes += 1;
    }

    for (const match of round.matches) {
      if (match.status !== 'completed') continue;

      const isDraw = match.outcome === 'draw' || match.winnerPair === null;
      const pairAWon = match.outcome === 'pair_a_win' || match.winnerPair === 'A';
      const [a1, a2] = match.pairA;
      const [b1, b2] = match.pairB;

      for (const pid of [a1, a2]) {
        const s = statsMap.get(pid);
        if (!s) continue;
        s.gamesPlayed += 1;
        if (isDraw) s.draws += 1;
        else if (pairAWon) s.wins += 1;
        else s.losses += 1;
        s.pointsFor += match.pairAScore;
        s.pointsAgainst += match.pairBScore;

        if (!isDraw) {
          const delta = pairAWon ? 1 : -1;
          for (const oppId of [b1, b2]) {
            s.headToHeadNet.set(oppId, (s.headToHeadNet.get(oppId) ?? 0) + delta);
          }
        }
      }

      for (const pid of [b1, b2]) {
        const s = statsMap.get(pid);
        if (!s) continue;
        s.gamesPlayed += 1;
        if (isDraw) s.draws += 1;
        else if (!pairAWon) s.wins += 1;
        else s.losses += 1;
        s.pointsFor += match.pairBScore;
        s.pointsAgainst += match.pairAScore;

        if (!isDraw) {
          const delta = !pairAWon ? 1 : -1;
          for (const oppId of [a1, a2]) {
            s.headToHeadNet.set(oppId, (s.headToHeadNet.get(oppId) ?? 0) + delta);
          }
        }
      }
    }
  }

  const rows: StandingRow[] = [...statsMap.values()].map((s) => {
    const pointDiff = s.pointsFor - s.pointsAgainst;
    const matchPoints = s.wins + 0.5 * s.draws;
    const winRate = s.gamesPlayed > 0 ? matchPoints / s.gamesPlayed : 0;
    const avgPointDiff = s.gamesPlayed > 0 ? pointDiff / s.gamesPlayed : 0;
    const avgPointsFor = s.gamesPlayed > 0 ? s.pointsFor / s.gamesPlayed : 0;

    return {
      rank: 1,
      isTied: false,
      participantId: s.participant.id,
      participantNumber: s.participant.number,
      displayName: s.participant.displayName,
      status: s.participant.status,
      ...(s.participant.isSubstitute !== undefined ? { isSubstitute: s.participant.isSubstitute } : {}),
      gamesPlayed: s.gamesPlayed,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      matchPoints: Number(matchPoints.toFixed(2)),
      winRate: Number(winRate.toFixed(6)),
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointDiff,
      avgPointDiff: Number(avgPointDiff.toFixed(4)),
      avgPointsFor: Number(avgPointsFor.toFixed(4)),
      byes: s.byes
    };
  });

  rows.sort((a, b) => {
    const primary = comparePrimaryMetrics(a, b, rankingMode);
    if (primary !== 0) return primary;
    return a.participantNumber - b.participantNumber;
  });

  const resolved: StandingRow[] = [];
  let cursor = 0;
  while (cursor < rows.length) {
    let end = cursor + 1;
    while (end < rows.length && comparePrimaryMetrics(rows[cursor]!, rows[end]!, rankingMode) === 0) {
      end += 1;
    }

    const group = rows.slice(cursor, end);
    if (group.length > 1) {
      const groupIds = group.map((g) => g.participantId);
      const h2hScore = new Map<string, number>();
      for (const member of group) {
        const st = statsMap.get(member.participantId)!;
        let net = 0;
        for (const otherId of groupIds) {
          if (otherId !== member.participantId) {
            net += st.headToHeadNet.get(otherId) ?? 0;
          }
        }
        h2hScore.set(member.participantId, net);
      }

      group.sort((a, b) => {
        const byH2H = compareDesc(
          h2hScore.get(a.participantId) ?? 0,
          h2hScore.get(b.participantId) ?? 0
        );
        if (byH2H !== 0) return byH2H;
        return a.participantNumber - b.participantNumber;
      });

      let idxInGroup = 0;
      while (idxInGroup < group.length) {
        const baseScore = h2hScore.get(group[idxInGroup]!.participantId) ?? 0;
        let subEnd = idxInGroup + 1;
        while (
          subEnd < group.length &&
          (h2hScore.get(group[subEnd]!.participantId) ?? 0) === baseScore
        ) {
          subEnd += 1;
        }
        const rankNumber = resolved.length + 1;
        const isTrulyTied = subEnd - idxInGroup > 1;
        for (let k = idxInGroup; k < subEnd; k++) {
          const item = group[k]!;
          resolved.push({
            ...item,
            rank: rankNumber,
            isTied: isTrulyTied
          });
        }
        idxInGroup = subEnd;
      }
    } else {
      const only = group[0]!;
      resolved.push({
        ...only,
        rank: resolved.length + 1,
        isTied: false
      });
    }

    cursor = end;
  }

  return resolved;
}
