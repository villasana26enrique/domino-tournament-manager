/**
 * Deterministic PRNG based on FNV-1a 32-bit hashing + SplitMix32 + xoshiro128**.
 * Cross-platform reproducible in any JavaScript runtime; Math.random() is never used.
 */

function fnv1a32(input: string, initialHash = 0x811c9dc5): number {
  let hash = initialHash >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function rotl32(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export class SeededRng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private readonly seedLabel: string;

  constructor(seed: string) {
    this.seedLabel = seed;
    const h1 = fnv1a32(seed, 0x811c9dc5);
    const h2 = fnv1a32(`${seed}#salt`, 0x811c9dc5 ^ 0x9e3779b9);
    const mixer = splitmix32((h1 ^ rotl32(h2, 13)) >>> 0);

    this.s0 = mixer();
    this.s1 = mixer();
    this.s2 = mixer();
    this.s3 = mixer();

    // Ensure non-zero state (xoshiro128** requires at least one non-zero word)
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 0x9e3779b9;
    }
  }

  public fork(scope: string): SeededRng {
    return new SeededRng(`${this.seedLabel}::${scope}`);
  }

  public nextUint32(): number {
    const result = Math.imul(rotl32(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;

    this.s2 ^= t;
    this.s3 = rotl32(this.s3, 11);

    return result >>> 0;
  }

  /** Returns a float in [0, 1). */
  public nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Returns an integer in [0, maxExclusive). */
  public nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`maxExclusive debe ser un entero positivo (recibido: ${maxExclusive}).`);
    }
    // Rejection sampling to avoid modulo bias
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let value = this.nextUint32();
    while (value >= limit) {
      value = this.nextUint32();
    }
    return value % maxExclusive;
  }

  /** Returns an integer in [minInclusive, maxInclusive]. */
  public nextIntRange(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new RangeError('maxInclusive debe ser mayor o igual a minInclusive.');
    }
    return minInclusive + this.nextInt(maxInclusive - minInclusive + 1);
  }

  /** Returns a new deterministically shuffled array using Fisher-Yates. */
  public shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
    }
    return copy;
  }
}
