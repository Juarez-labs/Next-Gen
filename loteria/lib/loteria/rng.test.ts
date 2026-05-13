import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("hello");
    const b = createRng("hello");
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = createRng("seed-A");
    const b = createRng("seed-B");
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("shuffle preserves elements", () => {
    const rng = createRng("shuffle");
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    rng.shuffle(arr);
    expect(arr.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("sample returns k distinct elements", () => {
    const rng = createRng(42);
    const out = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(out.length).toBe(4);
    expect(new Set(out).size).toBe(4);
    for (const v of out) expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).toContain(v);
  });

  it("int returns [0, max)", () => {
    const rng = createRng("int");
    for (let i = 0; i < 100; i++) {
      const v = rng.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it("exposes the seed string for persistence", () => {
    const rng = createRng("persist-me");
    expect(rng.seed).toBe("persist-me");
    const auto = createRng();
    expect(auto.seed.length).toBeGreaterThan(0);
  });
});
