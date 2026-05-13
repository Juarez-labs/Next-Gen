import { describe, expect, it } from "vitest";

import { generateBoards } from "./board-generator";
import { BOARD_SIZE, CORNER_POSITIONS, DECK_SIZE } from "./types";
import { validateBoardSet } from "./validator";

function counts(boards: number[][], deckSize = DECK_SIZE): Map<number, number> {
  const m = new Map<number, number>();
  for (let c = 1; c <= deckSize; c++) m.set(c, 0);
  for (const b of boards) for (const c of b) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

describe("generateBoards — casual mode", () => {
  it("produces N boards of 16 unique cards from 1..54", () => {
    const result = generateBoards({
      mode: "casual",
      boardCount: 25,
      seed: "casual-1",
    });
    expect(result.boards.length).toBe(25);
    for (const b of result.boards) {
      expect(b.cards.length).toBe(BOARD_SIZE);
      expect(new Set(b.cards).size).toBe(BOARD_SIZE);
      for (const c of b.cards) {
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(DECK_SIZE);
      }
    }
  });

  it("has no duplicate board combinations", () => {
    const result = generateBoards({
      mode: "casual",
      boardCount: 50,
      seed: "casual-uniq",
    });
    const keys = new Set(
      result.boards.map((b) => [...b.cards].sort((a, z) => a - z).join(",")),
    );
    expect(keys.size).toBe(50);
  });

  it("is deterministic for a given seed", () => {
    const a = generateBoards({
      mode: "casual",
      boardCount: 10,
      seed: "abc",
    });
    const b = generateBoards({
      mode: "casual",
      boardCount: 10,
      seed: "abc",
    });
    expect(a.boards.map((x) => x.cards)).toEqual(b.boards.map((x) => x.cards));
  });

  it("uses an auto seed when none is supplied", () => {
    const r = generateBoards({ mode: "casual", boardCount: 3 });
    expect(r.seed.length).toBeGreaterThan(0);
  });
});

describe("generateBoards — balanced mode", () => {
  it("keeps card frequencies within ±tolerance of target", () => {
    const boardCount = 30;
    const tolerance = 2;
    const result = generateBoards({
      mode: "balanced",
      boardCount,
      seed: "bal-1",
      balanceTolerance: tolerance,
    });
    const target = (boardCount * BOARD_SIZE) / DECK_SIZE;
    const freq = counts(result.boards.map((b) => b.cards));
    for (const [, c] of freq) {
      expect(Math.abs(c - target)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("produces boards that pass validation in balanced mode", () => {
    const result = generateBoards({
      mode: "balanced",
      boardCount: 30,
      seed: "bal-validate",
    });
    const report = validateBoardSet(result.boards.map((b) => b.cards), {
      mode: "balanced",
    });
    expect(report.passes).toBe(true);
  });
});

describe("generateBoards — perfect mode", () => {
  it("produces an exact-balance 54-board set", () => {
    const result = generateBoards({
      mode: "perfect",
      boardCount: 54,
      seed: "perfect-1",
    });
    expect(result.boards.length).toBe(54);
    const target = (54 * BOARD_SIZE) / DECK_SIZE; // 16
    const freq = counts(result.boards.map((b) => b.cards));
    for (const [, c] of freq) expect(c).toBe(target);
  });

  it("passes full validation", () => {
    const result = generateBoards({
      mode: "perfect",
      boardCount: 54,
      seed: "perfect-validate",
    });
    const report = validateBoardSet(result.boards.map((b) => b.cards), {
      mode: "perfect",
    });
    expect(report.passes).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("rejects infeasible counts (non-divisible by deck size)", () => {
    expect(() =>
      generateBoards({
        mode: "perfect",
        boardCount: 7, // 7*16=112, not divisible by 54
        seed: "perfect-bad",
      }),
    ).toThrowError(/divisible/i);
  });

  it("has no duplicate board combinations across a 54-board run", () => {
    const result = generateBoards({
      mode: "perfect",
      boardCount: 54,
      seed: "perfect-uniq",
    });
    const keys = new Set(
      result.boards.map((b) => [...b.cards].sort((a, z) => a - z).join(",")),
    );
    expect(keys.size).toBe(54);
  });
});

describe("generateBoards — corner-balanced mode", () => {
  it("yields 4 corner appearances per card across 54 boards", () => {
    const result = generateBoards({
      mode: "corner-balanced",
      boardCount: 54,
      seed: "corner-1",
    });
    const cornerCounts = new Map<number, number>();
    for (let c = 1; c <= DECK_SIZE; c++) cornerCounts.set(c, 0);
    for (const b of result.boards) {
      for (const pos of CORNER_POSITIONS) {
        const c = b.cards[pos];
        cornerCounts.set(c, (cornerCounts.get(c) ?? 0) + 1);
      }
    }
    for (const [, count] of cornerCounts) expect(count).toBe(4);
  });

  it("also yields 16 total appearances per card", () => {
    const result = generateBoards({
      mode: "corner-balanced",
      boardCount: 54,
      seed: "corner-2",
    });
    const freq = counts(result.boards.map((b) => b.cards));
    for (const [, c] of freq) expect(c).toBe(16);
  });

  it("passes full validation in corner-balanced mode", () => {
    const result = generateBoards({
      mode: "corner-balanced",
      boardCount: 54,
      seed: "corner-validate",
    });
    const report = validateBoardSet(result.boards.map((b) => b.cards), {
      mode: "corner-balanced",
    });
    expect(report.passes).toBe(true);
    expect(report.errors).toEqual([]);
  });
});
