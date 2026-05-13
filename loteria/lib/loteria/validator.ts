// Lotería board-set validator.
// Implements all checks from playbook section 7.7 / 10.4 and produces a
// structured validation report. Operates in the integer card-id domain
// (1..deckSize). Tests in __tests__/validator.test.ts cover each branch.

import {
  BOARD_SIZE,
  CORNER_POSITIONS,
  DECK_SIZE,
  type Board,
  type CardId,
  type GenerationMode,
  type ValidateOptions,
  type ValidationCheck,
  type ValidationReport,
} from "./types";

const DEFAULT_BALANCE_TOLERANCE = 2;

interface InternalAcc {
  errors: string[];
  warnings: string[];
  checks: ValidationCheck[];
  cardFrequencies: Record<string, number>;
  cornerFrequencies: Record<string, number>;
}

function addCheck(acc: InternalAcc, name: string, passed: boolean, detail?: string) {
  acc.checks.push({ name, passed, ...(detail ? { detail } : {}) });
  if (!passed && detail) acc.errors.push(`${name}: ${detail}`);
}

function freqMap(boards: readonly Board[], deckSize: number): Record<string, number> {
  const map: Record<string, number> = {};
  for (let c = 1; c <= deckSize; c++) map[String(c).padStart(2, "0")] = 0;
  for (const b of boards) {
    for (const c of b) {
      const key = String(c).padStart(2, "0");
      map[key] = (map[key] ?? 0) + 1;
    }
  }
  return map;
}

function cornerFreqMap(
  boards: readonly Board[],
  deckSize: number,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (let c = 1; c <= deckSize; c++) map[String(c).padStart(2, "0")] = 0;
  for (const b of boards) {
    for (const pos of CORNER_POSITIONS) {
      const c = b[pos];
      if (c === undefined) continue;
      const key = String(c).padStart(2, "0");
      map[key] = (map[key] ?? 0) + 1;
    }
  }
  return map;
}

/**
 * Validate a single board: returns the list of error strings (empty = ok).
 * Useful for pre-insert checks before persistence.
 */
export function validateBoard(
  board: Board,
  options: ValidateOptions = {},
): string[] {
  const deckSize = options.deckSize ?? DECK_SIZE;
  const boardSize = options.boardSize ?? BOARD_SIZE;
  const errors: string[] = [];

  if (!Array.isArray(board)) {
    errors.push("board is not an array");
    return errors;
  }
  if (board.length !== boardSize) {
    errors.push(`board has ${board.length} cards, expected ${boardSize}`);
  }
  for (const c of board) {
    if (typeof c !== "number" || !Number.isInteger(c)) {
      errors.push(`non-integer card id: ${String(c)}`);
      continue;
    }
    if (c < 1 || c > deckSize) {
      errors.push(`card id out of range: ${c} (must be 1..${deckSize})`);
    }
  }
  const uniq = new Set(board);
  if (uniq.size !== board.length) {
    errors.push(`board has duplicate cards`);
  }
  return errors;
}

/**
 * Validate an entire board set and produce a structured ValidationReport.
 *
 * Always returns a report (does not throw on invalid input — invalidity is
 * captured in `checks` and `errors`). The `passes` field is `true` iff every
 * check passes.
 */
export function validateBoardSet(
  boards: readonly Board[],
  options: ValidateOptions = {},
): ValidationReport {
  const mode: GenerationMode | "unknown" = options.mode ?? "unknown";
  const deckSize = options.deckSize ?? DECK_SIZE;
  const boardSize = options.boardSize ?? BOARD_SIZE;
  const tolerance = options.balanceTolerance ?? DEFAULT_BALANCE_TOLERANCE;

  const acc: InternalAcc = {
    errors: [],
    warnings: [],
    checks: [],
    cardFrequencies: {},
    cornerFrequencies: {},
  };

  // 1. Valid card IDs and per-board structure ---------------------------------
  let allBoardsWellFormed = true;
  let allCardsInRange = true;
  let noDupsPerBoard = true;
  const perBoardErrors: string[] = [];
  for (let i = 0; i < boards.length; i++) {
    const errs = validateBoard(boards[i] as Board, { deckSize, boardSize });
    if (errs.length > 0) {
      allBoardsWellFormed = false;
      for (const e of errs) {
        perBoardErrors.push(`board ${i + 1}: ${e}`);
        if (e.includes("out of range")) allCardsInRange = false;
        if (e.includes("duplicate")) noDupsPerBoard = false;
      }
    }
  }
  addCheck(
    acc,
    "valid_card_ids",
    allCardsInRange,
    allCardsInRange ? undefined : "one or more card ids outside 1..deckSize",
  );
  addCheck(
    acc,
    "exactly_n_cards_per_board",
    allBoardsWellFormed && boards.every((b) => b.length === boardSize),
    "expected exactly " + boardSize + " cards per board",
  );
  addCheck(
    acc,
    "no_duplicate_cards_per_board",
    noDupsPerBoard,
    "duplicate cards within a board",
  );
  if (perBoardErrors.length > 0) acc.errors.push(...perBoardErrors);

  // 2. No duplicate board combinations ----------------------------------------
  const sortedKeys = boards.map((b) =>
    [...b].sort((a, z) => a - z).join(","),
  );
  const dupKey = sortedKeys.find((k, i) => sortedKeys.indexOf(k) !== i);
  addCheck(
    acc,
    "no_duplicate_boards",
    !dupKey,
    dupKey ? `duplicate board combination: ${dupKey}` : undefined,
  );

  // 3. Frequencies ------------------------------------------------------------
  acc.cardFrequencies = freqMap(boards, deckSize);
  acc.cornerFrequencies = cornerFreqMap(boards, deckSize);

  // 4. Mode-specific frequency checks -----------------------------------------
  if (mode === "balanced") {
    const target = (boards.length * boardSize) / deckSize;
    const offenders = Object.entries(acc.cardFrequencies).filter(
      ([, count]) => Math.abs(count - target) > tolerance,
    );
    addCheck(
      acc,
      "card_frequency_within_tolerance",
      offenders.length === 0,
      offenders.length === 0
        ? undefined
        : `${offenders.length} cards outside ±${tolerance} of target ${target}: ${offenders
            .slice(0, 5)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}${offenders.length > 5 ? "…" : ""}`,
    );
  }

  if (mode === "perfect" || mode === "corner-balanced") {
    const totalSlots = boards.length * boardSize;
    if (totalSlots % deckSize !== 0) {
      addCheck(
        acc,
        "card_frequency_exact",
        false,
        `board_count*board_size (${totalSlots}) not divisible by deck_size (${deckSize})`,
      );
    } else {
      const target = totalSlots / deckSize;
      const offenders = Object.entries(acc.cardFrequencies).filter(
        ([, count]) => count !== target,
      );
      addCheck(
        acc,
        "card_frequency_exact",
        offenders.length === 0,
        offenders.length === 0
          ? undefined
          : `${offenders.length} cards differ from target ${target}: ${offenders
              .slice(0, 5)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}${offenders.length > 5 ? "…" : ""}`,
      );
    }
  }

  if (mode === "corner-balanced") {
    const totalCornerSlots = boards.length * CORNER_POSITIONS.length;
    if (totalCornerSlots % deckSize !== 0) {
      addCheck(
        acc,
        "corner_frequency_exact",
        false,
        `board_count*4 (${totalCornerSlots}) not divisible by deck_size (${deckSize})`,
      );
    } else {
      const target = totalCornerSlots / deckSize;
      const offenders = Object.entries(acc.cornerFrequencies).filter(
        ([, count]) => count !== target,
      );
      addCheck(
        acc,
        "corner_frequency_exact",
        offenders.length === 0,
        offenders.length === 0
          ? undefined
          : `${offenders.length} cards have wrong corner count (target ${target}): ${offenders
              .slice(0, 5)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}${offenders.length > 5 ? "…" : ""}`,
      );
    }
  }

  // 5. Soft warnings ----------------------------------------------------------
  const unused: CardId[] = [];
  for (let c = 1; c <= deckSize; c++) {
    if ((acc.cardFrequencies[String(c).padStart(2, "0")] ?? 0) === 0) {
      unused.push(c);
    }
  }
  if (mode !== "casual" && unused.length > 0) {
    acc.warnings.push(
      `${unused.length} cards never appear: ${unused.slice(0, 8).join(", ")}${
        unused.length > 8 ? "…" : ""
      }`,
    );
  }

  const passes = acc.checks.every((c) => c.passed);
  return {
    passes,
    mode,
    boardCount: boards.length,
    deckSize,
    checks: acc.checks,
    cardFrequencies: acc.cardFrequencies,
    cornerFrequencies: acc.cornerFrequencies,
    warnings: acc.warnings,
    errors: acc.errors,
  };
}
