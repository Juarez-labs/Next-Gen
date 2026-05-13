// Core types for the Lotería board generator and validator.
// See loteria_game_creation_playbook.md sections 4, 7, 10.

/** Deck size for the standard Lotería deck. */
export const DECK_SIZE = 54;

/** Number of cards per board (4x4 grid). */
export const BOARD_SIZE = 16;

/**
 * Positions on a 4x4 board that are corners.
 * Index layout:
 *   0  1  2  3
 *   4  5  6  7
 *   8  9 10 11
 *  12 13 14 15
 */
export const CORNER_POSITIONS = [0, 3, 12, 15] as const;

/** Card ID — integer 1..54 in the generator domain. */
export type CardId = number;

/** A board is a list of card IDs in slot order (length = BOARD_SIZE). */
export type Board = CardId[];

export type GenerationMode =
  | "casual"
  | "balanced"
  | "perfect"
  | "corner-balanced";

export interface GenerateOptions {
  /** Generation mode. */
  mode: GenerationMode;
  /** How many boards to generate. */
  boardCount: number;
  /**
   * For balanced mode: max absolute deviation from per-card target frequency.
   * Default ±2 per playbook 4.8.
   */
  balanceTolerance?: number;
  /** Optional deterministic seed (string or integer). */
  seed?: string | number;
  /** Deck size — defaults to 54. */
  deckSize?: number;
  /** Board size — defaults to 16. */
  boardSize?: number;
}

export interface GeneratedBoard {
  /** 1-based board index. */
  boardNumber: number;
  /** Display label e.g. "TABLA 01". */
  label: string;
  /** Ordered card ids occupying slots 0..15. */
  cards: Board;
}

export interface GenerateResult {
  mode: GenerationMode;
  seed: string;
  generatedAt: string; // ISO timestamp
  boards: GeneratedBoard[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface ValidationReport {
  passes: boolean;
  mode: GenerationMode | "unknown";
  boardCount: number;
  deckSize: number;
  checks: ValidationCheck[];
  cardFrequencies: Record<string, number>;
  cornerFrequencies: Record<string, number>;
  warnings: string[];
  errors: string[];
}

export interface ValidateOptions {
  mode?: GenerationMode;
  deckSize?: number;
  boardSize?: number;
  /** Tolerance for balanced mode (default ±2). */
  balanceTolerance?: number;
}
