import { TOTAL_CARDS } from "../data/cards";
import type { WinMode } from "./types";

export const TABLA_SIZE = 16;
export const TABLA_COLS = 4;
export const TABLA_ROWS = 4;

const CORNERS = [0, 3, 12, 15];

const ROWS: number[][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
];

const COLS: number[][] = [
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
];

const DIAGS: number[][] = [
  [0, 5, 10, 15],
  [3, 6, 9, 12],
];

// Fisher-Yates shuffle of 0..n-1.
export function shuffleDeck(n: number = TOTAL_CARDS, rng: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each player's tabla is a random 16 cards from the 54.
export function generateTabla(rng: () => number = Math.random): number[] {
  return shuffleDeck(TOTAL_CARDS, rng).slice(0, TABLA_SIZE);
}

// Build the order in which the AI caller will draw cards (shuffled full deck).
export function generateCallOrder(rng: () => number = Math.random): number[] {
  return shuffleDeck(TOTAL_CARDS, rng);
}

export function isValidWin(args: {
  tabla: number[];
  marks: boolean[];
  calledCardIndices: Set<number>;
  winMode: WinMode;
}): boolean {
  const { tabla, marks, calledCardIndices, winMode } = args;
  if (tabla.length !== TABLA_SIZE || marks.length !== TABLA_SIZE) return false;

  // Step 1: every marked cell must correspond to a card that was actually called.
  for (let i = 0; i < TABLA_SIZE; i++) {
    if (marks[i] && !calledCardIndices.has(tabla[i])) return false;
  }

  const allMarked = (positions: number[]) => positions.every((p) => marks[p]);

  if (winMode === "corners") return allMarked(CORNERS);
  if (winMode === "full") return marks.every(Boolean);
  if (winMode === "row") {
    return [...ROWS, ...COLS, ...DIAGS].some(allMarked);
  }
  return false;
}

// Short, human-readable share code (no ambiguous chars).
export function generateGameCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
