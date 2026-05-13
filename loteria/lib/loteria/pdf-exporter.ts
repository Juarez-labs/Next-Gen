// Lotería PDF / archive export pipeline.
//
// Three concerns, kept separate so tests don't need Chromium:
//   1. Pure HTML builders (boards, caller deck) and the CSV builder.
//      → testable with a string assertion.
//   2. A Puppeteer wrapper that turns HTML into a PDF buffer.
//      → server-only, lazy import so unit tests don't pull Chromium.
//   3. High-level orchestrators that load board+card data from Supabase,
//      build HTML, render to PDF, and assemble a project ZIP.
//
// Reference: playbook sections 5.3–5.10 and 8.7.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

// ---------- Constants (mirror playbook 5.4) ---------------------------------

export const BOARD_CONSTANTS = {
  CARD_W: 300,
  CARD_H: 450,
  SPACING: 40,
  MARGIN_X: 40,
  MARGIN_TOP_GRID: 40,
  MARGIN_BOTTOM: 40,
  HEADER_H: 160,
  GRID_COLS: 4,
  GRID_ROWS: 4,
} as const;

export const BOARD_CANVAS = {
  width:
    BOARD_CONSTANTS.GRID_COLS * BOARD_CONSTANTS.CARD_W +
    (BOARD_CONSTANTS.GRID_COLS - 1) * BOARD_CONSTANTS.SPACING +
    2 * BOARD_CONSTANTS.MARGIN_X, // 1400
  height:
    BOARD_CONSTANTS.HEADER_H +
    BOARD_CONSTANTS.MARGIN_TOP_GRID +
    BOARD_CONSTANTS.GRID_ROWS * BOARD_CONSTANTS.CARD_H +
    (BOARD_CONSTANTS.GRID_ROWS - 1) * BOARD_CONSTANTS.SPACING +
    BOARD_CONSTANTS.MARGIN_BOTTOM, // 2160
} as const;

export const HEADER_BG = "#F5F5F5";
export const BOARD_BG = "#EEEEEE";
export const TEXT_COLOR = "#111111";

// ---------- Data shapes -----------------------------------------------------

export interface ExportCard {
  card_number: number;
  english_name: string;
  spanish_name: string;
  category?: string | null;
  image_url: string | null;
}

export interface ExportBoard {
  board_number: number;
  label: string;
  /** 16 cards in slot order (row-major). */
  cards: ExportCard[];
}

// ---------- Batching --------------------------------------------------------

export interface BoardBatch {
  startBoardNumber: number;
  endBoardNumber: number;
  boards: ExportBoard[];
  /** Suggested file name e.g. "boards_01-05.pdf". */
  fileName: string;
}

/**
 * Split a sequence of boards into PDF batches of a given size.
 * Boards must already be sorted by board_number ascending.
 */
export function batchBoards(boards: ExportBoard[], batchSize: number): BoardBatch[] {
  if (batchSize <= 0) throw new Error("batchSize must be > 0");
  const batches: BoardBatch[] = [];
  for (let i = 0; i < boards.length; i += batchSize) {
    const slice = boards.slice(i, i + batchSize);
    const startNum = slice[0].board_number;
    const endNum = slice[slice.length - 1].board_number;
    batches.push({
      startBoardNumber: startNum,
      endBoardNumber: endNum,
      boards: slice,
      fileName: `boards_${pad2(startNum)}-${pad2(endNum)}.pdf`,
    });
  }
  return batches;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// ---------- HTML escaping ---------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- Board HTML builder ---------------------------------------------

export interface BoardHtmlOptions {
  /** Page format. Defaults to Letter per playbook 5.7. */
  pageFormat?: "Letter" | "A4";
  /** Logical page size in CSS inches. Used for scaling. */
  pageWidthIn?: number;
  pageHeightIn?: number;
}

const LETTER = { widthIn: 8.5, heightIn: 11 } as const;
const A4 = { widthIn: 8.27, heightIn: 11.69 } as const;

function pageDimensions(opts: BoardHtmlOptions): {
  widthIn: number;
  heightIn: number;
  cssSize: string;
} {
  if (opts.pageWidthIn && opts.pageHeightIn) {
    return {
      widthIn: opts.pageWidthIn,
      heightIn: opts.pageHeightIn,
      cssSize: `${opts.pageWidthIn}in ${opts.pageHeightIn}in`,
    };
  }
  if (opts.pageFormat === "A4") {
    return { widthIn: A4.widthIn, heightIn: A4.heightIn, cssSize: "A4" };
  }
  return { widthIn: LETTER.widthIn, heightIn: LETTER.heightIn, cssSize: "Letter" };
}

/**
 * Compute the CSS scale factor to fit the 1400x2160 board canvas inside the
 * given page dimensions while preserving aspect ratio. Limits by the more
 * constraining axis (typically height for portrait Letter).
 */
export function boardScaleForPage(pageWidthIn: number, pageHeightIn: number): number {
  const dpi = 96;
  const pageWPx = pageWidthIn * dpi;
  const pageHPx = pageHeightIn * dpi;
  const scaleW = pageWPx / BOARD_CANVAS.width;
  const scaleH = pageHPx / BOARD_CANVAS.height;
  return Math.min(scaleW, scaleH);
}

/**
 * Build the HTML document for a batch of boards, one board per page.
 *
 * The board is rendered at its natural 1400x2160 px dimensions and scaled to
 * fit the chosen page size with a CSS transform. This keeps the on-canvas
 * layout numerically identical to playbook 5.4 while still printing on
 * standard paper.
 */
export function buildBoardHtml(
  boards: ExportBoard[],
  opts: BoardHtmlOptions = {},
): string {
  const page = pageDimensions(opts);
  const scale = boardScaleForPage(page.widthIn, page.heightIn);

  const cardW = BOARD_CONSTANTS.CARD_W;
  const cardH = BOARD_CONSTANTS.CARD_H;
  const spacing = BOARD_CONSTANTS.SPACING;
  const marginX = BOARD_CONSTANTS.MARGIN_X;
  const headerH = BOARD_CONSTANTS.HEADER_H;
  const gridTop = headerH + BOARD_CONSTANTS.MARGIN_TOP_GRID;

  const boardPages = boards.map((board) => renderBoardPage(board)).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Lotería Boards</title>
<style>
  @page { size: ${page.cssSize}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Times New Roman", "Georgia", serif; color: ${TEXT_COLOR}; }
  .board-page {
    width: ${page.widthIn}in;
    height: ${page.heightIn}in;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    overflow: hidden;
  }
  .board-page:last-child { page-break-after: auto; }
  .board-scale {
    width: ${BOARD_CANVAS.width * scale}px;
    height: ${BOARD_CANVAS.height * scale}px;
    overflow: hidden;
  }
  .board {
    width: ${BOARD_CANVAS.width}px;
    height: ${BOARD_CANVAS.height}px;
    background: ${BOARD_BG};
    position: relative;
    transform: scale(${scale});
    transform-origin: top left;
  }
  .board-header {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: ${headerH}px;
    background: ${HEADER_BG};
    border-bottom: 2px solid #cccccc;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 ${marginX}px;
    font-weight: 700;
    font-size: 64px;
    letter-spacing: 0.04em;
  }
  .board-grid {
    position: absolute;
    top: ${gridTop}px;
    left: ${marginX}px;
    display: grid;
    grid-template-columns: repeat(${BOARD_CONSTANTS.GRID_COLS}, ${cardW}px);
    grid-template-rows: repeat(${BOARD_CONSTANTS.GRID_ROWS}, ${cardH}px);
    grid-gap: ${spacing}px;
  }
  .card {
    width: ${cardW}px;
    height: ${cardH}px;
    background: #fdf6e3;
    border: 4px solid #111111;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .card .number-box {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 56px;
    height: 56px;
    background: #111111;
    color: #fdf6e3;
    font-weight: 700;
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }
  .card .english-name {
    text-align: center;
    font-size: 20px;
    font-weight: 600;
    padding: 14px 12px 4px;
    flex: 0 0 auto;
  }
  .card .art {
    flex: 1 1 auto;
    background-position: center center;
    background-size: cover;
    background-repeat: no-repeat;
    background-color: #f0e7c8;
    margin: 0 12px;
  }
  .card .spanish-name {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    font-family: "Times New Roman", serif;
    padding: 6px 12px 14px;
    flex: 0 0 auto;
  }
</style>
</head>
<body>
${boardPages}
</body>
</html>`;
}

function renderBoardPage(board: ExportBoard): string {
  if (board.cards.length !== 16) {
    throw new Error(
      `renderBoardPage: board ${board.board_number} has ${board.cards.length} cards, expected 16`,
    );
  }
  const cardsHtml = board.cards.map((c) => renderCard(c)).join("\n");
  return `<section class="board-page">
  <div class="board-scale">
    <div class="board">
      <div class="board-header">
        <span>LOTERÍA</span>
        <span>${escapeHtml(board.label)}</span>
      </div>
      <div class="board-grid">
${cardsHtml}
      </div>
    </div>
  </div>
</section>`;
}

function renderCard(card: ExportCard): string {
  const artStyle = card.image_url
    ? `style="background-image: url('${escapeAttr(card.image_url)}');"`
    : "";
  return `        <div class="card">
          <div class="number-box">${pad2(card.card_number)}</div>
          <div class="english-name">${escapeHtml(card.english_name)}</div>
          <div class="art" ${artStyle}></div>
          <div class="spanish-name">${escapeHtml(card.spanish_name)}</div>
        </div>`;
}

function escapeAttr(s: string): string {
  // For URL inside a single-quoted CSS background-image, escape ' and \.
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ---------- Caller deck HTML builder ---------------------------------------

export interface CallerDeckHtmlOptions {
  pageFormat?: "Letter" | "A4";
  /** Cards per page. Default 6 (2x3 multi-up). */
  cardsPerPage?: number;
}

/**
 * Build the caller deck PDF HTML — multi-up layout listing every card with
 * number, English name, Spanish name, and thumbnail.
 */
export function buildCallerDeckHtml(
  cards: ExportCard[],
  opts: CallerDeckHtmlOptions = {},
): string {
  const cardsPerPage = opts.cardsPerPage ?? 6;
  const cssSize = opts.pageFormat === "A4" ? "A4" : "Letter";

  const sorted = [...cards].sort((a, b) => a.card_number - b.card_number);
  const pages: ExportCard[][] = [];
  for (let i = 0; i < sorted.length; i += cardsPerPage) {
    pages.push(sorted.slice(i, i + cardsPerPage));
  }

  const pagesHtml = pages
    .map((pageCards) => {
      const items = pageCards
        .map((c) => {
          const artStyle = c.image_url
            ? `style="background-image: url('${escapeAttr(c.image_url)}');"`
            : "";
          return `<li class="caller-card">
  <div class="thumb" ${artStyle}></div>
  <div class="meta">
    <div class="num">#${pad2(c.card_number)}</div>
    <div class="english">${escapeHtml(c.english_name)}</div>
    <div class="spanish">${escapeHtml(c.spanish_name)}</div>
  </div>
</li>`;
        })
        .join("\n");
      return `<section class="caller-page"><ul class="caller-grid">${items}</ul></section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Lotería Caller Deck</title>
<style>
  @page { size: ${cssSize}; margin: 0.5in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: ${TEXT_COLOR};
    font-family: "Times New Roman", "Georgia", serif; }
  .caller-page { page-break-after: always; }
  .caller-page:last-child { page-break-after: auto; }
  .caller-grid {
    list-style: none;
    margin: 0; padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 0.4in;
  }
  .caller-card {
    border: 2px solid #111;
    background: #fdf6e3;
    padding: 0.15in;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 3.1in;
  }
  .caller-card .thumb {
    width: 100%;
    flex: 1 1 auto;
    background-color: #f0e7c8;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid #d4c79a;
  }
  .caller-card .meta { text-align: center; padding-top: 8px; }
  .caller-card .num { font-weight: 700; font-size: 16px; letter-spacing: 0.05em; }
  .caller-card .english { font-size: 14px; }
  .caller-card .spanish { font-weight: 700; font-size: 18px; padding-top: 2px; }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

// ---------- Card index CSV --------------------------------------------------

/**
 * Build a CSV index of all cards — playbook 5.10 / 8.7.
 * Columns: card_id (number), english_name, spanish_name, category, image_path
 */
export function buildCardIndexCsv(cards: ExportCard[]): string {
  const header = "card_id,english_name,spanish_name,category,image_path";
  const sorted = [...cards].sort((a, b) => a.card_number - b.card_number);
  const rows = sorted.map((c) =>
    [
      c.card_number.toString(),
      csvField(c.english_name),
      csvField(c.spanish_name),
      csvField(c.category ?? ""),
      csvField(c.image_url ?? ""),
    ].join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------- Puppeteer wrapper (server-only) --------------------------------

export interface RenderHtmlOptions {
  /** Page format passed to puppeteer.pdf. Defaults to "Letter". */
  format?: "Letter" | "A4";
  /** Margin string, e.g. "0in". Defaults to none — we control margins via @page. */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  /** Print background colors/images. Defaults true (we need it for board bg). */
  printBackground?: boolean;
}

/**
 * Render an HTML string to a PDF byte buffer using Puppeteer.
 *
 * Server-only. Caller is responsible for providing valid HTML.
 *
 * Honors `PUPPETEER_EXECUTABLE_PATH` env var when set (useful for serverless
 * deployments that ship Chromium separately).
 */
export async function renderHtmlToPdf(
  html: string,
  opts: RenderHtmlOptions = {},
): Promise<Buffer> {
  // Lazy import so unit tests for the HTML builders don't pull Chromium.
  const puppeteer = (await import("puppeteer")).default;

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: opts.format ?? "Letter",
      printBackground: opts.printBackground ?? true,
      margin: opts.margin ?? { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ---------- Supabase loaders -----------------------------------------------

type DB = Database;

export interface ExportProjectData {
  project: DB["public"]["Tables"]["projects"]["Row"];
  cards: ExportCard[];
  boards: ExportBoard[];
}

/**
 * Load everything needed to build the export bundle for a project.
 *
 * Reads:
 *   - the project row,
 *   - all cards (ordered by card_number),
 *   - all boards (ordered by board_number) and resolves card_ids → cards.
 */
export async function loadProjectExportData(
  supabase: SupabaseClient<DB>,
  projectId: string,
): Promise<ExportProjectData> {
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (projErr || !project) {
    throw new Error(`loadProjectExportData: project — ${projErr?.message ?? "not found"}`);
  }

  const { data: cardRows, error: cardsErr } = await supabase
    .from("cards")
    .select("id, card_number, english_name, spanish_name, category, image_url")
    .eq("project_id", projectId)
    .order("card_number", { ascending: true });
  if (cardsErr) {
    throw new Error(`loadProjectExportData: cards — ${cardsErr.message}`);
  }
  const cardsById = new Map<string, ExportCard>();
  const cards: ExportCard[] = (cardRows ?? []).map((row) => {
    const card: ExportCard = {
      card_number: row.card_number,
      english_name: row.english_name,
      spanish_name: row.spanish_name,
      category: row.category,
      image_url: row.image_url,
    };
    cardsById.set(row.id, card);
    return card;
  });

  const { data: boardRows, error: boardsErr } = await supabase
    .from("boards")
    .select("id, board_number, label, card_ids")
    .eq("project_id", projectId)
    .order("board_number", { ascending: true });
  if (boardsErr) {
    throw new Error(`loadProjectExportData: boards — ${boardsErr.message}`);
  }
  const boards: ExportBoard[] = (boardRows ?? []).map((row) => ({
    board_number: row.board_number,
    label: row.label,
    cards: row.card_ids.map((id) => {
      const card = cardsById.get(id);
      if (!card) {
        throw new Error(
          `loadProjectExportData: board ${row.board_number} references unknown card ${id}`,
        );
      }
      return card;
    }),
  }));

  return { project, cards, boards };
}

// ---------- Orchestrators ---------------------------------------------------

export interface BoardPdfFile {
  fileName: string;
  startBoardNumber: number;
  endBoardNumber: number;
  bytes: Buffer;
}

export interface ExportBoardsOptions {
  /** Boards per PDF batch. Default 5 per playbook 5.7. */
  batchSize?: number;
  pageFormat?: "Letter" | "A4";
}

/**
 * Render all boards for a project as batched PDF files.
 *
 * Returns an in-memory list of files; callers typically zip or stream them.
 */
export async function exportBoardsAsPdfs(
  supabase: SupabaseClient<DB>,
  projectId: string,
  opts: ExportBoardsOptions = {},
): Promise<BoardPdfFile[]> {
  const data = await loadProjectExportData(supabase, projectId);
  if (data.boards.length === 0) {
    throw new Error(`exportBoardsAsPdfs: project ${projectId} has no boards to export`);
  }
  const batches = batchBoards(data.boards, opts.batchSize ?? 5);
  const files: BoardPdfFile[] = [];
  for (const batch of batches) {
    const html = buildBoardHtml(batch.boards, { pageFormat: opts.pageFormat });
    const bytes = await renderHtmlToPdf(html, { format: opts.pageFormat });
    files.push({
      fileName: batch.fileName,
      startBoardNumber: batch.startBoardNumber,
      endBoardNumber: batch.endBoardNumber,
      bytes,
    });
  }
  return files;
}

export async function exportCallerDeckPdf(
  supabase: SupabaseClient<DB>,
  projectId: string,
  opts: { pageFormat?: "Letter" | "A4"; cardsPerPage?: number } = {},
): Promise<Buffer> {
  const data = await loadProjectExportData(supabase, projectId);
  if (data.cards.length === 0) {
    throw new Error(`exportCallerDeckPdf: project ${projectId} has no cards`);
  }
  const html = buildCallerDeckHtml(data.cards, opts);
  return renderHtmlToPdf(html, { format: opts.pageFormat });
}

export interface ProjectZipOptions {
  batchSize?: number;
  pageFormat?: "Letter" | "A4";
  /** Include per-board image PNGs (rendered from the same HTML). Default false. */
  includeBoardImages?: boolean;
}

/**
 * Build the full project ZIP package — board PDFs, caller deck PDF,
 * card index CSV, and project metadata. Mirrors playbook 5.10 layout.
 */
export async function exportProjectZip(
  supabase: SupabaseClient<DB>,
  projectId: string,
  opts: ProjectZipOptions = {},
): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const data = await loadProjectExportData(supabase, projectId);

  const zip = new JSZip();
  const root = zip.folder(slugify(data.project.name)) ?? zip;
  const deckFolder = root.folder("deck");
  const boardsFolder = root.folder("boards");
  const boardsPdfFolder = boardsFolder?.folder("pdf");
  const metadataFolder = root.folder("metadata");

  // Card index CSV.
  deckFolder?.file("card_index.csv", buildCardIndexCsv(data.cards));

  // Caller deck PDF.
  if (data.cards.length > 0) {
    const callerHtml = buildCallerDeckHtml(data.cards, { pageFormat: opts.pageFormat });
    const callerPdf = await renderHtmlToPdf(callerHtml, { format: opts.pageFormat });
    deckFolder?.file("caller_deck.pdf", callerPdf);
  }

  // Board PDFs (batched).
  if (data.boards.length > 0) {
    const batches = batchBoards(data.boards, opts.batchSize ?? 5);
    for (const batch of batches) {
      const html = buildBoardHtml(batch.boards, { pageFormat: opts.pageFormat });
      const pdf = await renderHtmlToPdf(html, { format: opts.pageFormat });
      boardsPdfFolder?.file(batch.fileName, pdf);
    }
  }

  // Metadata JSON.
  metadataFolder?.file(
    "project.json",
    JSON.stringify(
      {
        id: data.project.id,
        name: data.project.name,
        theme: data.project.theme,
        deck_size: data.project.deck_size,
        board_size: data.project.board_size,
        board_count: data.project.board_count,
        status: data.project.status,
        exported_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  metadataFolder?.file(
    "deck.json",
    JSON.stringify(
      data.cards.map((c) => ({
        card_number: c.card_number,
        english_name: c.english_name,
        spanish_name: c.spanish_name,
        category: c.category,
        image_url: c.image_url,
      })),
      null,
      2,
    ),
  );
  metadataFolder?.file(
    "board_layouts.json",
    JSON.stringify(
      data.boards.map((b) => ({
        board_number: b.board_number,
        label: b.label,
        card_numbers: b.cards.map((c) => c.card_number),
      })),
      null,
      2,
    ),
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return buf;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "loteria_project";
}
