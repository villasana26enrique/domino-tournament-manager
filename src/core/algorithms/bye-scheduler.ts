import { SeededRng } from '../prng/seeded-rng.js';
import type { Participant } from '../domain/types.js';
import { computeParticipationMath } from './round-count-planner.js';

/**
 * Schedules byes for all rounds 1..plannedRounds using modular cyclic rotation over a seeded
 * permutation of active participants.
 *
 * Mathematical guarantees whenever byesPerRound <= activePerRound (always true without table cap):
 * - Maximum difference in total byes between any two players is at most 1.
 * - Zero consecutive byes for any player across all rounds.
 */
export function scheduleByes(
  participants: readonly Participant[],
  plannedRounds: number,
  maxPhysicalTables: number | null,
  seed: string
): Record<number, string[]> {
  const active = participants
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.number - b.number);

  const math = computeParticipationMath(active.length, maxPhysicalTables);
  const numberById = new Map<string, number>(active.map((p) => [p.id, p.number]));
  const result: Record<number, string[]> = {};

  if (math.byesPerRound === 0) {
    for (let r = 1; r <= plannedRounds; r++) {
      result[r] = [];
    }
    return result;
  }

  const rng = new SeededRng(seed).fork('bye-schedule');
  const order = rng.shuffle(active.map((p) => p.id));
  const N = order.length;
  const B = math.byesPerRound;

  for (let r = 1; r <= plannedRounds; r++) {
    const startOffset = ((r - 1) * B) % N;
    const roundByes: string[] = [];
    for (let k = 0; k < B; k++) {
      roundByes.push(order[(startOffset + k) % N]!);
    }
    roundByes.sort((a, b) => (numberById.get(a) ?? 0) - (numberById.get(b) ?? 0));
    result[r] = roundByes;
  }

  return result;
}

/**
 * Replans byes ONLY for future rounds (fromRound..plannedRounds) after a mid-tournament
 * administrative withdrawal, preserving balance and avoiding consecutive byes whenever possible.
 */
export function replanRemainingByes(input: {
  activeParticipants: readonly Participant[];
  fromRound: number;
  plannedRounds: number;
  maxPhysicalTables: number | null;
  completedByesByPlayer: ReadonlyMap<string, number>;
  lastByeRoundByPlayer: ReadonlyMap<string, number>;
  seed: string;
}): Record<number, string[]> {
  const {
    activeParticipants,
    fromRound,
    plannedRounds,
    maxPhysicalTables,
    completedByesByPlayer,
    lastByeRoundByPlayer,
    seed
  } = input;

  const active = activeParticipants
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.number - b.number);

  const math = computeParticipationMath(active.length, maxPhysicalTables);
  const numberById = new Map<string, number>(active.map((p) => [p.id, p.number]));

  const cumulativeByes = new Map<string, number>();
  const lastByeRound = new Map<string, number>();
  for (const p of active) {
    cumulativeByes.set(p.id, completedByesByPlayer.get(p.id) ?? 0);
    const prev = lastByeRoundByPlayer.get(p.id);
    if (prev !== undefined) {
      lastByeRound.set(p.id, prev);
    }
  }

  const rng = new SeededRng(seed).fork(`replan-byes-from-${fromRound}`);
  const tieOrder = new Map<string, number>();
  rng.shuffle(active.map((p) => p.id)).forEach((id, idx) => tieOrder.set(id, idx));

  const result: Record<number, string[]> = {};

  for (let r = fromRound; r <= plannedRounds; r++) {
    if (math.byesPerRound === 0) {
      result[r] = [];
      continue;
    }

    const sortedCandidates = [...active.map((p) => p.id)].sort((a, b) => {
      const aConsec = lastByeRound.get(a) === r - 1 ? 1 : 0;
      const bConsec = lastByeRound.get(b) === r - 1 ? 1 : 0;
      if (aConsec !== bConsec) return aConsec - bConsec;

      const aByes = cumulativeByes.get(a) ?? 0;
      const bByes = cumulativeByes.get(b) ?? 0;
      if (aByes !== bByes) return aByes - bByes;

      return (tieOrder.get(a) ?? 0) - (tieOrder.get(b) ?? 0);
    });

    const selected = sortedCandidates.slice(0, math.byesPerRound);
    for (const id of selected) {
      cumulativeByes.set(id, (cumulativeByes.get(id) ?? 0) + 1);
      lastByeRound.set(id, r);
    }

    selected.sort((a, b) => (numberById.get(a) ?? 0) - (numberById.get(b) ?? 0));
    result[r] = selected;
  }

  return result;
}
