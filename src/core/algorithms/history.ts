import type {
  CompletedRound,
  GeneratedRound,
  Participant,
  TournamentHistory
} from '../domain/types.js';

export function makePairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function makeTableKey(participantId: string, tableNumber: number): string {
  return `${participantId}::T${tableNumber}`;
}

export function createEmptyHistory(participants: readonly Participant[]): TournamentHistory {
  const byesByPlayer = new Map<string, number>();
  const gamesByPlayer = new Map<string, number>();
  for (const p of participants) {
    byesByPlayer.set(p.id, 0);
    gamesByPlayer.set(p.id, 0);
  }
  return {
    completedRoundsCount: 0,
    partnerCounts: new Map<string, number>(),
    opponentCounts: new Map<string, number>(),
    tableCounts: new Map<string, number>(),
    byesByPlayer,
    gamesByPlayer,
    lastByeRoundByPlayer: new Map<string, number>()
  };
}

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Purely derives complete tournament interaction history from rounds (generated or completed).
 */
export function buildTournamentHistory(
  participants: readonly Participant[],
  rounds: readonly (GeneratedRound | CompletedRound)[]
): TournamentHistory {
  const history = createEmptyHistory(participants);

  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);

  for (const round of sortedRounds) {
    history.completedRoundsCount += 1;

    for (const byeId of round.byes) {
      incrementMap(history.byesByPlayer, byeId);
      history.lastByeRoundByPlayer.set(byeId, round.roundNumber);
    }

    for (const match of round.matches) {
      const [a1, a2] = match.pairA;
      const [b1, b2] = match.pairB;

      // Partners
      incrementMap(history.partnerCounts, makePairKey(a1, a2));
      incrementMap(history.partnerCounts, makePairKey(b1, b2));

      // Opponents (4 cross edges)
      incrementMap(history.opponentCounts, makePairKey(a1, b1));
      incrementMap(history.opponentCounts, makePairKey(a1, b2));
      incrementMap(history.opponentCounts, makePairKey(a2, b1));
      incrementMap(history.opponentCounts, makePairKey(a2, b2));

      // Games & table counts
      for (const pid of [a1, a2, b1, b2]) {
        incrementMap(history.gamesByPlayer, pid);
        incrementMap(history.tableCounts, makeTableKey(pid, match.tableNumber));
      }
    }
  }

  return history;
}
