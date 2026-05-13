// Persistence helpers: convert generator output (card_number → 1..54) into
// Supabase `boards` rows (card_ids → uuid[]) and store the corresponding
// validation report.
//
// The generator runs in pure card-number space so it can be tested without a
// DB. This module is the only piece that talks to Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type {
  GenerateResult,
  GeneratedBoard,
  ValidationReport,
} from "./types";

type DB = Database;
type BoardInsert = DB["public"]["Tables"]["boards"]["Insert"];
type ValidationInsert =
  DB["public"]["Tables"]["validation_reports"]["Insert"];

export interface PersistOptions {
  /** If true, allow inserting boards even if validation has errors. */
  allowInvalid?: boolean;
  /** If true, mark each board as locked at write time. */
  lock?: boolean;
}

export interface PersistResult {
  insertedBoardIds: string[];
  validationReportId: string;
}

/**
 * Build a `card_number → card_id (uuid)` lookup for the given project.
 *
 * Throws if any expected card_number (1..deckSize) is missing.
 */
export async function loadCardLookup(
  supabase: SupabaseClient<DB>,
  projectId: string,
  deckSize: number,
): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from("cards")
    .select("id, card_number")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`loadCardLookup: ${error.message}`);
  }
  const lookup = new Map<number, string>();
  for (const row of data ?? []) {
    lookup.set(row.card_number, row.id);
  }
  for (let c = 1; c <= deckSize; c++) {
    if (!lookup.has(c)) {
      throw new Error(
        `loadCardLookup: project ${projectId} is missing card_number ${c}`,
      );
    }
  }
  return lookup;
}

/** Map an array of card numbers to UUIDs, raising if any are unknown. */
export function mapCardNumbersToIds(
  cards: readonly number[],
  lookup: ReadonlyMap<number, string>,
): string[] {
  return cards.map((n) => {
    const id = lookup.get(n);
    if (!id) throw new Error(`unknown card_number ${n} for project`);
    return id;
  });
}

/**
 * Persist a generated board set + its validation report to Supabase.
 *
 * Honors the "never silently regenerate" rule (playbook 7.8) by refusing to
 * overwrite boards whose `locked_at` is set. Callers must explicitly delete or
 * release locked boards before re-persisting.
 *
 * Returns the inserted board ids and the validation report id.
 */
export async function persistBoardSet(
  supabase: SupabaseClient<DB>,
  projectId: string,
  generated: GenerateResult,
  report: ValidationReport,
  options: PersistOptions = {},
): Promise<PersistResult> {
  if (!report.passes && !options.allowInvalid) {
    throw new Error(
      `persistBoardSet: validation failed (${report.errors.length} errors). Pass allowInvalid=true to override.`,
    );
  }

  // Refuse to overwrite locked boards.
  const { data: existing, error: existingErr } = await supabase
    .from("boards")
    .select("id, board_number, locked_at")
    .eq("project_id", projectId);
  if (existingErr) {
    throw new Error(`persistBoardSet: read existing — ${existingErr.message}`);
  }
  const locked = (existing ?? []).filter((row) => row.locked_at);
  if (locked.length > 0) {
    throw new Error(
      `persistBoardSet: ${locked.length} boards are locked (numbers: ${locked
        .map((b) => b.board_number)
        .join(", ")}). Delete or release them before regenerating.`,
    );
  }

  // Resolve card_number → uuid for this project.
  const lookup = await loadCardLookup(supabase, projectId, report.deckSize);

  // Clear any existing unlocked boards for this project, then bulk insert.
  if ((existing ?? []).length > 0) {
    const { error: delErr } = await supabase
      .from("boards")
      .delete()
      .eq("project_id", projectId);
    if (delErr) {
      throw new Error(`persistBoardSet: clear existing — ${delErr.message}`);
    }
  }

  const now = new Date().toISOString();
  const rows: BoardInsert[] = generated.boards.map((b: GeneratedBoard) => ({
    project_id: projectId,
    board_number: b.boardNumber,
    label: b.label,
    card_ids: mapCardNumbersToIds(b.cards, lookup),
    seed: generated.seed,
    locked_at: options.lock ? now : null,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("boards")
    .insert(rows)
    .select("id");
  if (insertErr) {
    throw new Error(`persistBoardSet: insert boards — ${insertErr.message}`);
  }

  // Persist the validation report.
  const reportRow: ValidationInsert = {
    project_id: projectId,
    board_count: report.boardCount,
    passes: report.passes,
    checks_json: report.checks as unknown as DB["public"]["Tables"]["validation_reports"]["Insert"]["checks_json"],
    card_frequencies_json:
      report.cardFrequencies as unknown as DB["public"]["Tables"]["validation_reports"]["Insert"]["card_frequencies_json"],
    warnings:
      report.warnings as unknown as DB["public"]["Tables"]["validation_reports"]["Insert"]["warnings"],
  };
  const { data: reportInserted, error: reportErr } = await supabase
    .from("validation_reports")
    .insert(reportRow)
    .select("id")
    .single();
  if (reportErr) {
    throw new Error(
      `persistBoardSet: insert validation report — ${reportErr.message}`,
    );
  }

  return {
    insertedBoardIds: (inserted ?? []).map((r) => r.id),
    validationReportId: reportInserted.id,
  };
}
