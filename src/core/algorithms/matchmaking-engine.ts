import { ConstraintViolationError } from '../domain/errors.js';
import type {
  GeneratedMatch,
  GeneratedRound,
  Participant,
  StandingRow,
  TournamentConfig,
  TournamentHistory
} from '../domain/types.js';
import {
  validateParticipants,
  validateSeed,
  validateTournamentConfig
} from '../domain/validation.js';
import { SeededRng } from '../prng/seeded-rng.js';
import { validateRoundConstraints } from './constraint-validator.js';
import { evaluateRoundFairness } from './fairness-evaluator.js';
import { createEmptyHistory, makePairKey, makeTableKey } from './history.js';
import { computeParticipationMath } from './round-count-planner.js';

const WEIGHT_PARTNER_REPEAT = 10_000;
const WEIGHT_OPPONENT_REPEAT = 120;
const WEIGHT_TABLE_REPEAT = 2;

function getCompetitiveWeight(roundNumber: number, config: TournamentConfig): number {
  if (config.schedulingMode !== 'hybrid_competitive' || !config.allowCompetitivePairing) {
    return 0;
  }
  if (roundNumber <= 1) return 0;
  if (roundNumber === 2) return 4;
  if (roundNumber === 3) return 12;
  return 25;
}

interface SearchMatrices {
  A: number;
  M: number;
  ids: string[];
  partnerMatrix: Int32Array;
  opponentMatrix: Int32Array;
  rankIndex: Int32Array;
  competitiveWeight: number;
}

function buildMatrices(
  playingIds: readonly string[],
  history: TournamentHistory,
  standings: readonly StandingRow[],
  competitiveWeight: number
): SearchMatrices {
  const A = playingIds.length;
  const M = A / 4;
  const ids = [...playingIds];
  const partnerMatrix = new Int32Array(A * A);
  const opponentMatrix = new Int32Array(A * A);
  const rankIndex = new Int32Array(A);

  const standingsRankMap = new Map<string, number>();
  standings.forEach((row, idx) => standingsRankMap.set(row.participantId, idx));

  for (let i = 0; i < A; i++) {
    const idI = ids[i]!;
    rankIndex[i] = standingsRankMap.get(idI) ?? i;
    for (let j = i + 1; j < A; j++) {
      const idJ = ids[j]!;
      const key = makePairKey(idI, idJ);
      const pCount = history.partnerCounts.get(key) ?? 0;
      const oCount = history.opponentCounts.get(key) ?? 0;
      partnerMatrix[i * A + j] = pCount;
      partnerMatrix[j * A + i] = pCount;
      opponentMatrix[i * A + j] = oCount;
      opponentMatrix[j * A + i] = oCount;
    }
  }

  return { A, M, ids, partnerMatrix, opponentMatrix, rankIndex, competitiveWeight };
}

function computeTableCost(state: Int32Array, t: number, m: SearchMatrices): number {
  const base = t * 4;
  const a = state[base]!;
  const b = state[base + 1]!;
  const c = state[base + 2]!;
  const d = state[base + 3]!;
  const A = m.A;

  const pA = m.partnerMatrix[a * A + b]!;
  const pB = m.partnerMatrix[c * A + d]!;
  let cost = WEIGHT_PARTNER_REPEAT * (pA * pA + pB * pB);

  const o1 = m.opponentMatrix[a * A + c]!;
  const o2 = m.opponentMatrix[a * A + d]!;
  const o3 = m.opponentMatrix[b * A + c]!;
  const o4 = m.opponentMatrix[b * A + d]!;
  cost += WEIGHT_OPPONENT_REPEAT * (o1 * o1 + o2 * o2 + o3 * o3 + o4 * o4);

  if (m.competitiveWeight > 0) {
    const ra = m.rankIndex[a]!;
    const rb = m.rankIndex[b]!;
    const rc = m.rankIndex[c]!;
    const rd = m.rankIndex[d]!;
    const minR = Math.min(ra, rb, rc, rd);
    const maxR = Math.max(ra, rb, rc, rd);
    const spread = maxR - minR;
    const balance = Math.abs(ra + rb - (rc + rd));
    cost += m.competitiveWeight * (spread + 2 * balance);
  }

  return cost;
}

function computeTotalCost(state: Int32Array, m: SearchMatrices): number {
  let total = 0;
  for (let t = 0; t < m.M; t++) {
    total += computeTableCost(state, t, m);
  }
  return total;
}

function canCompleteSingleTableZeroPartnerRepeats(
  futureGroups: readonly [string, string, string, string][],
  groupIndex: number,
  usedPartners: Set<string>
): boolean {
  if (groupIndex >= futureGroups.length) {
    return true;
  }

  const [p0, p1, p2, p3] = futureGroups[groupIndex]!;
  const options: [[string, string], [string, string]][] = [
    [
      [p0, p1],
      [p2, p3]
    ],
    [
      [p0, p2],
      [p1, p3]
    ],
    [
      [p0, p3],
      [p1, p2]
    ]
  ];

  for (const [pairA, pairB] of options) {
    const kA = makePairKey(pairA[0], pairA[1]);
    const kB = makePairKey(pairB[0], pairB[1]);
    if (usedPartners.has(kA) || usedPartners.has(kB)) continue;

    usedPartners.add(kA);
    usedPartners.add(kB);
    if (canCompleteSingleTableZeroPartnerRepeats(futureGroups, groupIndex + 1, usedPartners)) {
      usedPartners.delete(kA);
      usedPartners.delete(kB);
      return true;
    }
    usedPartners.delete(kA);
    usedPartners.delete(kB);
  }

  return false;
}

function solveSingleTable(
  m: SearchMatrices,
  rng: SeededRng,
  history: TournamentHistory,
  futureGroups: readonly [string, string, string, string][]
): Int32Array {
  const permutations: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2]
  ];
  const shuffled = rng.shuffle(permutations);

  // When future single-table rounds are known (N=4..7), prefer pairings that remain
  // provably extendable to zero partner repeats across all remaining rounds.
  const canLookahead = futureGroups.length > 0 && futureGroups.length <= 7;
  const baseUsedPartners = new Set<string>();
  if (canLookahead) {
    for (const [key, count] of history.partnerCounts.entries()) {
      if (count > 0) baseUsedPartners.add(key);
    }
  }

  let best = new Int32Array(shuffled[0]!);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const perm of shuffled) {
    const candidate = new Int32Array(perm);
    let score = computeTableCost(candidate, 0, m);

    if (canLookahead) {
      const kA = makePairKey(m.ids[perm[0]]!, m.ids[perm[1]]!);
      const kB = makePairKey(m.ids[perm[2]]!, m.ids[perm[3]]!);
      if (!baseUsedPartners.has(kA) && !baseUsedPartners.has(kB)) {
        const trialUsed = new Set(baseUsedPartners);
        trialUsed.add(kA);
        trialUsed.add(kB);
        const extendable = canCompleteSingleTableZeroPartnerRepeats(futureGroups, 0, trialUsed);
        if (!extendable) {
          // Strong penalty so extendable zero-repeat paths always win over dead-ends
          score += WEIGHT_PARTNER_REPEAT;
        }
      }
    }

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function greedyPolish(state: Int32Array, m: SearchMatrices): number {
  let improved = true;
  let totalCost = computeTotalCost(state, m);

  while (improved) {
    improved = false;

    // 1. Exhaustive intra-table optimal pairing check
    for (let t = 0; t < m.M; t++) {
      const base = t * 4;
      const oldCost = computeTableCost(state, t, m);
      const a = state[base]!;
      const b = state[base + 1]!;
      const c = state[base + 2]!;
      const d = state[base + 3]!;

      // Option 2: (a,c) vs (b,d)
      state[base + 1] = c;
      state[base + 2] = b;
      const opt2 = computeTableCost(state, t, m);

      // Option 3: (a,d) vs (b,c)
      state[base + 1] = d;
      state[base + 2] = b;
      state[base + 3] = c;
      const opt3 = computeTableCost(state, t, m);

      if (opt2 < oldCost && opt2 <= opt3) {
        state[base + 1] = c;
        state[base + 2] = b;
        state[base + 3] = d;
        totalCost += opt2 - oldCost;
        improved = true;
      } else if (opt3 < oldCost) {
        // already in opt3
        totalCost += opt3 - oldCost;
        improved = true;
      } else {
        // restore
        state[base] = a;
        state[base + 1] = b;
        state[base + 2] = c;
        state[base + 3] = d;
      }
    }

    // 2. Inter-table single player swaps (exact first-improvement sweep for M <= 15)
    if (m.M <= 15) {
      for (let i = 0; i < m.A; i++) {
        const t1 = i >> 2;
        for (let j = (t1 + 1) * 4; j < m.A; j++) {
          const t2 = j >> 2;
          const oldPair = computeTableCost(state, t1, m) + computeTableCost(state, t2, m);
          const tmp = state[i]!;
          state[i] = state[j]!;
          state[j] = tmp;
          const newPair = computeTableCost(state, t1, m) + computeTableCost(state, t2, m);
          if (newPair < oldPair) {
            totalCost += newPair - oldPair;
            improved = true;
          } else {
            state[j] = state[i]!;
            state[i] = tmp;
          }
        }
      }
    }
  }

  return totalCost;
}

function solveMultiTable(m: SearchMatrices, rng: SeededRng): Int32Array {
  const numStarts = m.M <= 10 ? 24 : 16;
  const stepsPerStart = Math.min(3500, 700 + m.M * 240);

  let globalBest = new Int32Array(m.A);
  let globalBestCost = Number.POSITIVE_INFINITY;

  // Base indices sorted by rank for competitive seeding
  const rankSorted = Array.from({ length: m.A }, (_, idx) => idx).sort(
    (x, y) => m.rankIndex[x]! - m.rankIndex[y]!
  );
  const allIndices = Array.from({ length: m.A }, (_, idx) => idx);

  for (let start = 0; start < numStarts; start++) {
    let initArray: number[];
    if (m.competitiveWeight > 0 && start % 2 === 0) {
      // Seed near-competitive blocks with internal 1+4 vs 2+3 ordering + small perturbation
      initArray = [...rankSorted];
      for (let t = 0; t < m.M; t++) {
        const base = t * 4;
        // Reorder [0,1,2,3] -> [0,3,1,2] for balanced 1+4 vs 2+3 pairs
        const p1 = initArray[base + 1]!;
        const p2 = initArray[base + 2]!;
        const p3 = initArray[base + 3]!;
        initArray[base + 1] = p3;
        initArray[base + 2] = p1;
        initArray[base + 3] = p2;
      }
      // Small deterministic jitter
      const jitterSwaps = Math.max(1, Math.floor(m.M / 2));
      for (let k = 0; k < jitterSwaps; k++) {
        const i = rng.nextInt(m.A);
        const j = rng.nextInt(m.A);
        const tmp = initArray[i]!;
        initArray[i] = initArray[j]!;
        initArray[j] = tmp;
      }
    } else {
      initArray = rng.shuffle(allIndices);
    }

    const current = new Int32Array(initArray);
    let currentCost = computeTotalCost(current, m);
    let localBest = new Int32Array(current);
    let localBestCost = currentCost;

    if (localBestCost === 0) {
      return localBest;
    }

    const tStart = 350;
    const tEnd = 0.5;
    const cooling = Math.pow(tEnd / tStart, 1 / stepsPerStart);
    let temp = tStart;

    for (let step = 0; step < stepsPerStart; step++) {
      const moveRoll = rng.nextInt(100);

      if (moveRoll < 22) {
        // Intra-table partner swap
        const t = rng.nextInt(m.M);
        const base = t * 4;
        const oldT = computeTableCost(current, t, m);
        const swapWith = rng.nextInt(2) === 0 ? base + 2 : base + 3;
        const tmp = current[base + 1]!;
        current[base + 1] = current[swapWith]!;
        current[swapWith] = tmp;

        const newT = computeTableCost(current, t, m);
        const delta = newT - oldT;

        if (delta <= 0 || rng.nextFloat() < Math.exp(-delta / temp)) {
          currentCost += delta;
          if (currentCost < localBestCost) {
            localBestCost = currentCost;
            localBest.set(current);
            if (localBestCost === 0) return localBest;
          }
        } else {
          current[swapWith] = current[base + 1]!;
          current[base + 1] = tmp;
        }
      } else {
        // Inter-table single player swap
        const t1 = rng.nextInt(m.M);
        let t2 = rng.nextInt(m.M - 1);
        if (t2 >= t1) t2 += 1;

        const i = t1 * 4 + rng.nextInt(4);
        const j = t2 * 4 + rng.nextInt(4);

        const oldPair = computeTableCost(current, t1, m) + computeTableCost(current, t2, m);
        const tmp = current[i]!;
        current[i] = current[j]!;
        current[j] = tmp;

        const newPair = computeTableCost(current, t1, m) + computeTableCost(current, t2, m);
        const delta = newPair - oldPair;

        if (delta <= 0 || rng.nextFloat() < Math.exp(-delta / temp)) {
          currentCost += delta;
          if (currentCost < localBestCost) {
            localBestCost = currentCost;
            localBest.set(current);
            if (localBestCost === 0) return localBest;
          }
        } else {
          current[j] = current[i]!;
          current[i] = tmp;
        }
      }

      temp *= cooling;
    }

    localBestCost = greedyPolish(localBest, m);
    if (localBestCost < globalBestCost) {
      globalBestCost = localBestCost;
      globalBest = localBest;
      if (globalBestCost === 0) return globalBest;
    }
  }

  return globalBest;
}

function assignTableNumbers(
  rawTables: Array<{ pairA: [string, string]; pairB: [string, string] }>,
  history: TournamentHistory,
  standings: readonly StandingRow[],
  competitiveWeight: number
): GeneratedMatch[] {
  const M = rawTables.length;

  if (competitiveWeight > 0 && standings.length > 0) {
    // In competitive rounds, Mesa 1 hosts the top-ranked group for clear spectator/projector UX
    const rankMap = new Map<string, number>();
    standings.forEach((row, idx) => rankMap.set(row.participantId, idx + 1));

    const sorted = [...rawTables].sort((t1, t2) => {
      const avg1 =
        [...t1.pairA, ...t1.pairB].reduce((acc, id) => acc + (rankMap.get(id) ?? 999), 0) / 4;
      const avg2 =
        [...t2.pairA, ...t2.pairB].reduce((acc, id) => acc + (rankMap.get(id) ?? 999), 0) / 4;
      if (avg1 !== avg2) return avg1 - avg2;
      return t1.pairA[0].localeCompare(t2.pairA[0]);
    });

    return sorted.map((t, idx) => ({
      tableNumber: idx + 1,
      pairA: t.pairA,
      pairB: t.pairB
    }));
  }

  // Non-competitive rounds: optimize table index assignment to diversify physical tables
  const perm = Array.from({ length: M }, (_, idx) => idx);
  const tableRepeatCost = (groupIdx: number, tableNum: number): number => {
    const g = rawTables[groupIdx]!;
    let sum = 0;
    for (const id of [...g.pairA, ...g.pairB]) {
      sum += (history.tableCounts.get(makeTableKey(id, tableNum)) ?? 0) * WEIGHT_TABLE_REPEAT;
    }
    return sum;
  };

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < M; i++) {
      for (let j = i + 1; j < M; j++) {
        const gI = perm[i]!;
        const gJ = perm[j]!;
        const oldC = tableRepeatCost(gI, i + 1) + tableRepeatCost(gJ, j + 1);
        const newC = tableRepeatCost(gJ, i + 1) + tableRepeatCost(gI, j + 1);
        if (newC < oldC) {
          perm[i] = gJ;
          perm[j] = gI;
          improved = true;
        }
      }
    }
  }

  return perm.map((groupIdx, idx) => ({
    tableNumber: idx + 1,
    pairA: rawTables[groupIdx]!.pairA,
    pairB: rawTables[groupIdx]!.pairB
  }));
}

export function generateRound(input: {
  roundNumber: number;
  activeParticipants: readonly Participant[];
  plannedByes: readonly string[];
  futurePlannedByesByRound?: Record<number, string[]>;
  history?: TournamentHistory;
  standings?: readonly StandingRow[];
  config: TournamentConfig;
  seed: string;
}): GeneratedRound {
  const { roundNumber, plannedByes, futurePlannedByesByRound } = input;
  const config = validateTournamentConfig(input.config);
  const validatedParticipants = validateParticipants(input.activeParticipants);
  const seed = validateSeed(input.seed);

  const active = validatedParticipants
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.number - b.number);
  const math = computeParticipationMath(active.length, config.maxPhysicalTables);

  const history = input.history ?? createEmptyHistory(active);
  const standings = input.standings ?? [];

  const byeSet = new Set(plannedByes);
  if (byeSet.size !== math.byesPerRound) {
    throw new ConstraintViolationError(
      `Cantidad de descansos inválida para la Ronda ${roundNumber}: se esperaban ${math.byesPerRound} y se recibieron ${byeSet.size}.`
    );
  }

  const playingIds = active.filter((p) => !byeSet.has(p.id)).map((p) => p.id);
  if (playingIds.length !== math.activePerRound) {
    throw new ConstraintViolationError(
      `Cantidad de activos inconsistente para la Ronda ${roundNumber}: se esperaban ${math.activePerRound} y se obtuvieron ${playingIds.length}.`
    );
  }

  const competitiveWeight = getCompetitiveWeight(roundNumber, config);
  const matrices = buildMatrices(playingIds, history, standings, competitiveWeight);
  const rng = new SeededRng(seed).fork(`round-${roundNumber}`);

  const futureSingleTableGroups: [string, string, string, string][] = [];
  if (matrices.M === 1 && futurePlannedByesByRound) {
    const futureRoundNumbers = Object.keys(futurePlannedByesByRound)
      .map(Number)
      .filter((r) => Number.isInteger(r) && r > roundNumber)
      .sort((a, b) => a - b);

    for (const r of futureRoundNumbers) {
      const fByes = new Set(futurePlannedByesByRound[r] ?? []);
      const fPlaying = active.filter((p) => !fByes.has(p.id)).map((p) => p.id);
      if (fPlaying.length === 4) {
        futureSingleTableGroups.push([fPlaying[0]!, fPlaying[1]!, fPlaying[2]!, fPlaying[3]!]);
      }
    }
  }

  const solution =
    matrices.M === 1
      ? solveSingleTable(matrices, rng, history, futureSingleTableGroups)
      : solveMultiTable(matrices, rng);

  const numberById = new Map<string, number>(active.map((p) => [p.id, p.number]));
  const rawTables: Array<{ pairA: [string, string]; pairB: [string, string] }> = [];

  for (let t = 0; t < matrices.M; t++) {
    const base = t * 4;
    const pA: [string, string] = [matrices.ids[solution[base]!]!, matrices.ids[solution[base + 1]!]!];
    const pB: [string, string] = [
      matrices.ids[solution[base + 2]!]!,
      matrices.ids[solution[base + 3]!]!
    ];
    // Canonical order within each pair by participant number
    if ((numberById.get(pA[0]) ?? 0) > (numberById.get(pA[1]) ?? 0)) {
      pA.reverse();
    }
    if ((numberById.get(pB[0]) ?? 0) > (numberById.get(pB[1]) ?? 0)) {
      pB.reverse();
    }
    rawTables.push({ pairA: pA, pairB: pB });
  }

  const matches = assignTableNumbers(rawTables, history, standings, competitiveWeight);
  const sortedByes = [...byeSet].sort(
    (a, b) => (numberById.get(a) ?? 0) - (numberById.get(b) ?? 0)
  );

  const prelimRound: GeneratedRound = {
    roundNumber,
    matches,
    byes: sortedByes,
    metrics: {
      repeatedPartnersInRound: 0,
      repeatedOpponentsInRound: 0,
      cumulativeMaxPartnerRepeats: 0,
      cumulativeMaxOpponentRepeats: 0,
      cumulativeByeSpread: 0,
      consecutiveByesCount: 0,
      competitiveSpreadAvg: 0,
      allHardConstraintsSatisfied: true
    },
    explanations: []
  };

  const violations = validateRoundConstraints({
    round: prelimRound,
    activeParticipants: active,
    maxPhysicalTables: config.maxPhysicalTables
  });

  if (violations.length > 0) {
    throw new ConstraintViolationError(
      `El motor violó restricciones obligatorias en la Ronda ${roundNumber}.`,
      violations
    );
  }

  const metrics = evaluateRoundFairness({
    roundNumber,
    matches,
    byes: sortedByes,
    activeParticipants: active,
    historyBeforeRound: history,
    standingsBeforeRound: standings,
    allHardConstraintsSatisfied: true
  });

  const explanations: string[] = [];
  explanations.push(
    metrics.repeatedPartnersInRound === 0
      ? 'Todos los jugadores juegan con un compañero inédito en esta ronda.'
      : `Se produjeron ${metrics.repeatedPartnersInRound} repeticiones inevitables o mínimas de compañero.`
  );
  explanations.push(
    metrics.repeatedOpponentsInRound === 0
      ? 'Todos los enfrentamientos entre rivales son inéditos.'
      : `Cruces con ${metrics.repeatedOpponentsInRound} repeticiones de rival minimizadas respecto al historial.`
  );
  if (competitiveWeight > 0 && standings.length > 0) {
    explanations.push(
      'Emparejamiento competitivo activo: mesas ordenadas por clasificación (Mesa 1 reúne líderes) con parejas equilibradas (1.º+4.º vs 2.º+3.º) sin sacrificar diversidad de compañeros.'
    );
  }
  if (sortedByes.length > 0) {
    explanations.push(
      `Descansan ${sortedByes.length} ${
        sortedByes.length === 1 ? 'participante' : 'participantes'
      } según el calendario equilibrado (diferencia acumulada ≤ ${metrics.cumulativeByeSpread}).`
    );
  }

  return {
    roundNumber,
    matches,
    byes: sortedByes,
    metrics,
    explanations
  };
}
