import { describe, expect, it } from "vitest";

import { generateBoards } from "./board-generator";
import { BOARD_SIZE, DECK_SIZE } from "./types";
import { validateBoard, validateBoardSet } from "./validator";

function makeBoard(start = 1): number[] {
  return Array.from({ length: BOARD_SIZE }, (_, i) => start + i);
}

describe("validateBoard", () => {
  it("accepts a valid board", () => {
    expect(validateBoard(makeBoard(1))).toEqual([]);
  });

  it("flags wrong length", () => {
    expect(validateBoard([1, 2, 3])).toEqual(
      expect.arrayContaining([expect.stringContaining("16")]),
    );
  });

  it("flags out-of-range cards", () => {
    const b = makeBoard(1);
    b[0] = 99;
    const errs = validateBoard(b);
    expect(errs.some((e) => e.includes("out of range"))).toBe(true);
  });

  it("flags duplicates within a board", () => {
    const b = makeBoard(1);
    b[1] = b[0];
    const errs = validateBoard(b);
    expect(errs.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("flags non-integer entries", () => {
    const b = [...makeBoard(1)] as unknown[];
    b[0] = "x";
    const errs = validateBoard(b as number[]);
    expect(errs.some((e) => e.includes("non-integer"))).toBe(true);
  });
});

describe("validateBoardSet", () => {
  it("returns passes=true for a valid casual set", () => {
    const r = generateBoards({
      mode: "casual",
      boardCount: 10,
      seed: "val-1",
    });
    const report = validateBoardSet(r.boards.map((b) => b.cards), {
      mode: "casual",
    });
    expect(report.passes).toBe(true);
  });

  it("detects duplicate boards", () => {
    const board = makeBoard(1);
    const report = validateBoardSet([board, board.slice()]);
    expect(report.passes).toBe(false);
    expect(report.checks.find((c) => c.name === "no_duplicate_boards")?.passed).toBe(
      false,
    );
  });

  it("detects out-of-range cards", () => {
    const board = makeBoard(1);
    board[0] = 99;
    const report = validateBoardSet([board]);
    expect(report.passes).toBe(false);
    expect(report.checks.find((c) => c.name === "valid_card_ids")?.passed).toBe(
      false,
    );
  });

  it("detects wrong card frequency in perfect mode", () => {
    // 54 boards but the same board repeated → frequencies wildly off.
    const board = makeBoard(1);
    const boards = Array.from({ length: 54 }, () => board.slice());
    const report = validateBoardSet(boards, { mode: "perfect" });
    expect(report.passes).toBe(false);
    expect(
      report.checks.find((c) => c.name === "card_frequency_exact")?.passed,
    ).toBe(false);
  });

  it("populates card and corner frequency maps", () => {
    const r = generateBoards({
      mode: "perfect",
      boardCount: 54,
      seed: "val-freq",
    });
    const report = validateBoardSet(r.boards.map((b) => b.cards), {
      mode: "perfect",
    });
    expect(Object.keys(report.cardFrequencies).length).toBe(DECK_SIZE);
    expect(Object.keys(report.cornerFrequencies).length).toBe(DECK_SIZE);
    for (const v of Object.values(report.cardFrequencies)) expect(v).toBe(16);
  });

  it("balanced mode catches out-of-tolerance frequencies", () => {
    // Force imbalance: 10 boards all use cards 1..16 → cards 1..16 appear 10x,
    // others 0x. Target for boardCount=10 is 10*16/54 ≈ 2.96. Way out.
    const boards = Array.from({ length: 10 }, () => makeBoard(1));
    // Make boards distinct by varying slot ordering only — still same cards.
    boards.forEach((b, i) => {
      b[0] = ((i + 1) % BOARD_SIZE) + 1; // tweak to dedup combinations
    });
    // (combinations are still identical sets — this is intentional to violate
    // the balanced check; uniqueness check will also fail, which is fine: this
    // test only asserts the balanced check fires.)
    const report = validateBoardSet(boards, {
      mode: "balanced",
      balanceTolerance: 1,
    });
    expect(
      report.checks.find((c) => c.name === "card_frequency_within_tolerance")
        ?.passed,
    ).toBe(false);
  });
});
