// Lotería board generator.
// Implements the four modes from playbook section 4.8:
//   - casual          (4.3 simple random)
//   - balanced        (4.5 each card within ±tolerance of target)
//   - perfect         (4.7 max-flow / bipartite matching for exact counts)
//   - corner-balanced (4.6 + 4.7 corners step)
//
// Generator works in the integer card-id domain (1..deckSize). Persistence
// layer is responsible for translating those ids to project-scoped card
// UUIDs when writing to the `boards` table.

import {
  BOARD_SIZE,
  CORNER_POSITIONS,
  DECK_SIZE,
  type Board,
  type CardId,
  type GenerateOptions,
  type GenerateResult,
  type GeneratedBoard,
} from "./types";
import { createRng, type Rng } from "./rng";

const DEFAULT_BALANCE_TOLERANCE = 2;
const BALANCED_MAX_ATTEMPTS = 200;

function boardLabel(n: number): string {
  return `TABLA ${String(n).padStart(2, "0")}`;
}

function boardKey(cards: readonly CardId[]): string {
  return [...cards].sort((a, b) => a - b).join(",");
}

function makeDeck(deckSize: number): CardId[] {
  return Array.from({ length: deckSize }, (_, i) => i + 1);
}

// ---------- Mode 1: Casual random (playbook 4.3) -----------------------------

function generateCasual(opts: Required<GenOpts>, rng: Rng): Board[] {
  const deck = makeDeck(opts.deckSize);
  const boards: Board[] = [];
  const seen = new Set<string>();
  const maxAttempts = opts.boardCount * 200;
  let attempts = 0;

  while (boards.length < opts.boardCount) {
    if (++attempts > maxAttempts) {
      throw new Error(
        `generateCasual: could not produce ${opts.boardCount} unique boards`,
      );
    }
    const sample = rng.sample(deck, opts.boardSize);
    const key = boardKey(sample);
    if (seen.has(key)) continue;
    seen.add(key);
    // sample is already in random order; shuffle once more for slot placement.
    boards.push(rng.shuffle(sample));
  }
  return boards;
}

// ---------- Mode 2: Balanced distribution (playbook 4.5) ---------------------

/**
 * Greedy balanced generator: at each pick, prefer cards whose current count is
 * lowest. Retries the whole run up to BALANCED_MAX_ATTEMPTS times until every
 * card frequency is within tolerance of target. Target = boardCount*16/deck.
 */
function generateBalanced(opts: Required<GenOpts>, rng: Rng): Board[] {
  const tolerance = opts.balanceTolerance;
  const target = (opts.boardCount * opts.boardSize) / opts.deckSize;

  for (let attempt = 0; attempt < BALANCED_MAX_ATTEMPTS; attempt++) {
    const result = tryBalancedRun(opts, rng);
    if (!result) continue;
    const counts = countCards(result, opts.deckSize);
    // counts[0] is unused (cards are 1..deckSize) — skip it.
    let maxDev = 0;
    for (let i = 1; i <= opts.deckSize; i++) {
      const d = Math.abs(counts[i] - target);
      if (d > maxDev) maxDev = d;
    }
    if (maxDev <= tolerance) return result;
  }
  throw new Error(
    `generateBalanced: could not satisfy tolerance ±${tolerance} after ${BALANCED_MAX_ATTEMPTS} attempts`,
  );
}

function tryBalancedRun(opts: Required<GenOpts>, rng: Rng): Board[] | null {
  const boards: Board[] = [];
  const seen = new Set<string>();
  const counts = new Array(opts.deckSize + 1).fill(0) as number[];

  for (let b = 0; b < opts.boardCount; b++) {
    let attempts = 0;
    let board: Board | null = null;
    while (attempts++ < 200) {
      const candidate = pickBalancedBoard(opts, rng, counts);
      const key = boardKey(candidate);
      if (!seen.has(key)) {
        seen.add(key);
        board = rng.shuffle(candidate);
        break;
      }
    }
    if (!board) return null;
    for (const c of board) counts[c]++;
    boards.push(board);
  }
  return boards;
}

function pickBalancedBoard(
  opts: Required<GenOpts>,
  rng: Rng,
  counts: readonly number[],
): CardId[] {
  // Sort cards by current count asc, ties broken randomly, pick first BOARD_SIZE.
  const tagged = makeDeck(opts.deckSize).map((id) => ({
    id,
    count: counts[id],
    tie: rng.next(),
  }));
  tagged.sort((a, b) => a.count - b.count || a.tie - b.tie);
  return tagged.slice(0, opts.boardSize).map((t) => t.id);
}

// ---------- Mode 3: Perfect balance via max-flow (playbook 4.7) --------------

/**
 * Exact-balance generator. Requires
 *   boardCount * boardSize % deckSize === 0
 * so the per-card target is an integer.
 *
 * Builds a bipartite assignment:
 *   source -> card (capacity = perCardTarget)
 *   card   -> board (capacity = 1, only if card not already in board)
 *   board  -> sink (capacity = boardSize)
 *
 * Uses Ford–Fulkerson with BFS (Edmonds–Karp). Small graph (54 cards × N boards)
 * so this is plenty fast.
 */
function generatePerfect(opts: Required<GenOpts>, rng: Rng): Board[] {
  const totalSlots = opts.boardCount * opts.boardSize;
  if (totalSlots % opts.deckSize !== 0) {
    throw new Error(
      `generatePerfect: boardCount*boardSize (${totalSlots}) must be divisible by deckSize (${opts.deckSize}) for exact balance`,
    );
  }
  const perCardTarget = totalSlots / opts.deckSize;
  const assignment = maxFlowAssignment(opts, rng, perCardTarget);

  // For each board, the assigned card list — shuffle into slots.
  return assignment.map((cards) => rng.shuffle(cards));
}

/**
 * Compute the per-board card assignment via max-flow.
 * Returns boards[bIdx] = list of card ids (length = boardSize).
 */
function maxFlowAssignment(
  opts: Required<GenOpts>,
  rng: Rng,
  perCardTarget: number,
  preassigned?: number[][], // optional cards already locked into each board (e.g. corners)
): number[][] {
  const D = opts.deckSize;
  const B = opts.boardCount;
  const need = opts.boardSize;

  // Node indexing:
  //   0          = source
  //   1..D       = card nodes
  //   D+1..D+B   = board nodes
  //   D+B+1      = sink
  const SRC = 0;
  const SINK = D + B + 1;
  const cardNode = (c: number) => c; // c is 1..D
  const boardNode = (b: number) => D + 1 + b; // b is 0..B-1
  const N = D + B + 2;

  const cap: number[][] = Array.from({ length: N }, () =>
    new Array(N).fill(0),
  );
  // Track which card→board edges exist (capacity 1 before flow).
  const cardBoardEdge: boolean[][] = Array.from({ length: D + 1 }, () =>
    new Array(B).fill(false),
  );

  // Track preassigned counts so we never exceed perCardTarget across rounds.
  const preCount = new Array(D + 1).fill(0) as number[];
  const preBoardCount = new Array(B).fill(0) as number[];
  if (preassigned) {
    for (let b = 0; b < B; b++) {
      const list = preassigned[b] ?? [];
      preBoardCount[b] = list.length;
      for (const c of list) {
        if (c < 1 || c > D) {
          throw new Error(`preassigned card out of range: ${c}`);
        }
        preCount[c]++;
      }
    }
  }

  // source -> card with remaining capacity = perCardTarget - already-used
  for (let c = 1; c <= D; c++) {
    const remaining = perCardTarget - preCount[c];
    if (remaining < 0) {
      throw new Error(
        `preassigned card ${c} exceeds per-card target ${perCardTarget}`,
      );
    }
    cap[SRC][cardNode(c)] = remaining;
  }

  // card -> board with capacity 1 (only if not already on that board)
  for (let b = 0; b < B; b++) {
    const already = new Set(preassigned?.[b] ?? []);
    for (let c = 1; c <= D; c++) {
      if (already.has(c)) continue;
      cap[cardNode(c)][boardNode(b)] = 1;
      cardBoardEdge[c][b] = true;
    }
  }

  // board -> sink with capacity = need - preassignedCount
  for (let b = 0; b < B; b++) {
    cap[boardNode(b)][SINK] = need - preBoardCount[b];
  }

  // Randomize neighbor scan order so multiple valid max-flows produce
  // varied (not symmetric/identical) assignments across seeds. Without this,
  // BFS scans neighbors in node-index order and tends to produce boards 0..15
  // with cards 1..16 (identical), etc.
  const neighborOrder: number[][] = [];
  for (let u = 0; u < N; u++) {
    const arr = Array.from({ length: N }, (_, i) => i);
    rng.shuffle(arr);
    neighborOrder.push(arr);
  }

  const total = edmondsKarp(cap, SRC, SINK, N, neighborOrder);
  const expected = B * need - sum(preBoardCount);
  if (total !== expected) {
    throw new Error(
      `max-flow assignment failed: got ${total}, expected ${expected}`,
    );
  }

  // Read off the assignment: an original card→board edge that has residual
  // capacity 0 carried flow.
  const boards: number[][] = Array.from({ length: B }, (_, b) => [
    ...(preassigned?.[b] ?? []),
  ]);
  for (let c = 1; c <= D; c++) {
    for (let b = 0; b < B; b++) {
      if (cardBoardEdge[c][b] && cap[cardNode(c)][boardNode(b)] === 0) {
        boards[b].push(c);
      }
    }
  }
  return boards;
}

function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

/**
 * Edmonds–Karp BFS max flow on a dense capacity matrix. Mutates `cap` in place.
 * `neighborOrder[u]` controls the order in which neighbors of `u` are scanned,
 * which lets callers break symmetry between multiple valid max flows.
 */
function edmondsKarp(
  cap: number[][],
  src: number,
  sink: number,
  n: number,
  neighborOrder?: number[][],
): number {
  let flow = 0;
  while (true) {
    const parent = new Array(n).fill(-1) as number[];
    parent[src] = src;
    const queue: number[] = [src];
    let head = 0;
    while (head < queue.length && parent[sink] === -1) {
      const u = queue[head++];
      const order = neighborOrder ? neighborOrder[u] : null;
      const limit = order ? order.length : n;
      for (let i = 0; i < limit; i++) {
        const v = order ? order[i] : i;
        if (parent[v] === -1 && cap[u][v] > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[sink] === -1) break;

    let pushFlow = Infinity;
    for (let v = sink; v !== src; v = parent[v]) {
      pushFlow = Math.min(pushFlow, cap[parent[v]][v]);
    }
    for (let v = sink; v !== src; v = parent[v]) {
      cap[parent[v]][v] -= pushFlow;
      cap[v][parent[v]] += pushFlow;
    }
    flow += pushFlow;
  }
  return flow;
}

// ---------- Mode 4: Strong corner balance (playbook 4.6 + 4.7) ----------------

/**
 * Strong corner balance.
 *
 * Step 1: Assign 4 distinct corner cards per board such that each card appears
 *         in a corner exactly cornerTarget = (B * 4) / D times. Requires
 *         B * 4 % D === 0.
 * Step 2: Fill the remaining 12 interior slots via max-flow so each card
 *         appears `perCardTarget - 4` more times across boards (interior only),
 *         where perCardTarget = B * 16 / D.
 * Step 3: Shuffle interior cards into non-corner positions; corners stay at
 *         positions [0, 3, 12, 15].
 */
function generateCornerBalanced(opts: Required<GenOpts>, rng: Rng): Board[] {
  const D = opts.deckSize;
  const B = opts.boardCount;
  const totalCornerSlots = B * CORNER_POSITIONS.length;
  if (totalCornerSlots % D !== 0) {
    throw new Error(
      `generateCornerBalanced: B*4 (${totalCornerSlots}) must be divisible by deckSize (${D}) for corner balance`,
    );
  }
  const cornerTarget = totalCornerSlots / D;

  const totalSlots = B * opts.boardSize;
  if (totalSlots % D !== 0) {
    throw new Error(
      `generateCornerBalanced: B*16 (${totalSlots}) must be divisible by deckSize (${D}) for full balance`,
    );
  }
  const perCardTarget = totalSlots / D;
  if (perCardTarget < cornerTarget) {
    throw new Error(
      "generateCornerBalanced: cornerTarget exceeds per-card target",
    );
  }

  // Step 1: corner assignment by round-robin offsets (playbook 4.7 step 1).
  // Round-robin guarantees each card appears `cornerTarget` times in corners
  // and 4 corners per board are distinct (since offsets are distinct mod D and
  // boardCount >= cornerTarget*D/4 boards cycle through).
  const cornerAssignments: number[][] = [];
  for (let b = 0; b < B; b++) {
    const set = new Set<number>();
    let offset = 0;
    while (set.size < 4) {
      const idx = ((b * 4 + offset) % D) + 1;
      set.add(idx);
      offset++;
    }
    const arr = [...set];
    rng.shuffle(arr);
    cornerAssignments.push(arr);
  }

  // Verify corner counts match cornerTarget exactly. Round-robin gives this
  // when B*4 is divisible by D; otherwise we throw above.
  const cornerCounts = new Array(D + 1).fill(0) as number[];
  for (const arr of cornerAssignments) for (const c of arr) cornerCounts[c]++;
  for (let c = 1; c <= D; c++) {
    if (cornerCounts[c] !== cornerTarget) {
      throw new Error(
        `corner round-robin produced count ${cornerCounts[c]} for card ${c}, expected ${cornerTarget}`,
      );
    }
  }

  // Step 2: assign the remaining 12 interior slots per board via max-flow,
  // honoring the per-card global cap of perCardTarget and excluding cards
  // already placed as corners on that board.
  const assignment = maxFlowAssignment(
    opts,
    rng,
    perCardTarget,
    cornerAssignments,
  );

  // Step 3: place corners at corner positions and interior cards at the rest.
  const interiorPositions: number[] = [];
  for (let i = 0; i < opts.boardSize; i++) {
    if (!CORNER_POSITIONS.includes(i as 0 | 3 | 12 | 15)) {
      interiorPositions.push(i);
    }
  }

  return assignment.map((cards, b) => {
    const corners = cornerAssignments[b];
    const cornerSet = new Set(corners);
    const interior = cards.filter((c) => !cornerSet.has(c));
    if (interior.length !== interiorPositions.length) {
      throw new Error(
        `generateCornerBalanced: interior count mismatch on board ${b + 1}`,
      );
    }
    rng.shuffle(interior);
    const slots: number[] = new Array(opts.boardSize).fill(0);
    CORNER_POSITIONS.forEach((pos, i) => (slots[pos] = corners[i]));
    interiorPositions.forEach((pos, i) => (slots[pos] = interior[i]));
    return slots;
  });
}

// ---------- helpers ----------------------------------------------------------

function countCards(boards: Board[], deckSize: number): number[] {
  const counts = new Array(deckSize + 1).fill(0) as number[];
  for (const b of boards) for (const c of b) counts[c]++;
  return counts;
}

type GenOpts = GenerateOptions;

function normalizeOptions(opts: GenerateOptions): Required<GenOpts> {
  if (!opts.boardCount || opts.boardCount < 1) {
    throw new Error("generateBoards: boardCount must be >= 1");
  }
  return {
    mode: opts.mode,
    boardCount: opts.boardCount,
    balanceTolerance: opts.balanceTolerance ?? DEFAULT_BALANCE_TOLERANCE,
    seed: opts.seed ?? "",
    deckSize: opts.deckSize ?? DECK_SIZE,
    boardSize: opts.boardSize ?? BOARD_SIZE,
  };
}

// ---------- public API -------------------------------------------------------

/**
 * Generate a set of Lotería boards for the given mode.
 *
 * Throws if the request is infeasible (e.g. perfect mode with non-integer
 * per-card target).
 */
export function generateBoards(options: GenerateOptions): GenerateResult {
  const opts = normalizeOptions(options);
  const rng = createRng(opts.seed === "" ? undefined : opts.seed);

  if (opts.boardSize !== BOARD_SIZE) {
    // The generator is hard-coded for a 4x4 board (corner positions etc.).
    // We allow it for testing but fail closed for non-standard sizes when
    // corner mode is requested.
    if (opts.mode === "corner-balanced" && opts.boardSize !== BOARD_SIZE) {
      throw new Error("corner-balanced mode requires boardSize=16");
    }
  }

  let raw: Board[];
  switch (opts.mode) {
    case "casual":
      raw = generateCasual(opts, rng);
      break;
    case "balanced":
      raw = generateBalanced(opts, rng);
      break;
    case "perfect":
      raw = generatePerfect(opts, rng);
      break;
    case "corner-balanced":
      raw = generateCornerBalanced(opts, rng);
      break;
    default: {
      const _exhaustive: never = opts.mode;
      throw new Error(`Unknown generation mode: ${String(_exhaustive)}`);
    }
  }

  const boards: GeneratedBoard[] = raw.map((cards, i) => ({
    boardNumber: i + 1,
    label: boardLabel(i + 1),
    cards,
  }));

  return {
    mode: opts.mode,
    seed: rng.seed,
    generatedAt: new Date().toISOString(),
    boards,
  };
}
