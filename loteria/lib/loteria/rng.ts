// Tiny deterministic RNG: xmur3 hash for seeding + mulberry32 PRNG.
// Used so board generation can be reproduced from a stored seed.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Return float in [0, 1). */
  next(): number;
  /** Return integer in [0, max). */
  int(max: number): number;
  /** Fisher–Yates shuffle in place; returns the same array. */
  shuffle<T>(arr: T[]): T[];
  /** Pick k distinct items from arr (k <= arr.length). */
  sample<T>(arr: readonly T[], k: number): T[];
  /** The seed string used to construct the RNG (for persistence). */
  readonly seed: string;
}

/**
 * Create a deterministic RNG from a string/number seed, or random if omitted.
 * The resolved seed is exposed via `rng.seed` so callers can persist it.
 */
export function createRng(seed?: string | number): Rng {
  const seedStr =
    seed === undefined || seed === null
      ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      : String(seed);

  const hash = xmur3(seedStr);
  const next = mulberry32(hash());

  return {
    seed: seedStr,
    next,
    int(max: number): number {
      if (max <= 0) throw new Error("rng.int: max must be > 0");
      return Math.floor(next() * max);
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    sample<T>(arr: readonly T[], k: number): T[] {
      if (k > arr.length) {
        throw new Error("rng.sample: k larger than array length");
      }
      const copy = arr.slice();
      // Partial Fisher–Yates: pick first k items.
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(next() * (copy.length - i));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, k);
    },
  };
}
