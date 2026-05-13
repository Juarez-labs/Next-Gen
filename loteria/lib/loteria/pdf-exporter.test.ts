import { describe, expect, it } from "vitest";

import {
  BOARD_CANVAS,
  BOARD_CONSTANTS,
  batchBoards,
  boardScaleForPage,
  buildBoardHtml,
  buildCallerDeckHtml,
  buildCardIndexCsv,
  escapeHtml,
  slugify,
  type ExportBoard,
  type ExportCard,
} from "./pdf-exporter";

function makeCard(n: number, overrides: Partial<ExportCard> = {}): ExportCard {
  return {
    card_number: n,
    english_name: `Card ${n}`,
    spanish_name: `Carta ${n}`,
    category: "test",
    image_url: `https://example.com/${n}.png`,
    ...overrides,
  };
}

function makeBoard(num: number, startCard = 1): ExportBoard {
  const cards: ExportCard[] = [];
  for (let i = 0; i < 16; i++) cards.push(makeCard(startCard + i));
  return {
    board_number: num,
    label: `TABLA ${num.toString().padStart(2, "0")}`,
    cards,
  };
}

describe("BOARD_CANVAS", () => {
  it("matches playbook 5.4 dimensions (1400x2160)", () => {
    expect(BOARD_CANVAS.width).toBe(1400);
    expect(BOARD_CANVAS.height).toBe(2160);
  });

  it("derives correct geometry from the constants", () => {
    const expectedW =
      BOARD_CONSTANTS.GRID_COLS * BOARD_CONSTANTS.CARD_W +
      (BOARD_CONSTANTS.GRID_COLS - 1) * BOARD_CONSTANTS.SPACING +
      2 * BOARD_CONSTANTS.MARGIN_X;
    expect(BOARD_CANVAS.width).toBe(expectedW);
  });
});

describe("batchBoards", () => {
  const boards = Array.from({ length: 12 }, (_, i) => makeBoard(i + 1));

  it("splits into batches of the requested size", () => {
    const batches = batchBoards(boards, 5);
    expect(batches).toHaveLength(3);
    expect(batches[0].boards).toHaveLength(5);
    expect(batches[1].boards).toHaveLength(5);
    expect(batches[2].boards).toHaveLength(2);
  });

  it("names files using zero-padded board numbers", () => {
    const batches = batchBoards(boards, 5);
    expect(batches[0].fileName).toBe("boards_01-05.pdf");
    expect(batches[1].fileName).toBe("boards_06-10.pdf");
    expect(batches[2].fileName).toBe("boards_11-12.pdf");
  });

  it("rejects batchSize <= 0", () => {
    expect(() => batchBoards(boards, 0)).toThrow();
  });
});

describe("boardScaleForPage", () => {
  it("Letter portrait limits by height (taller board than page)", () => {
    const scale = boardScaleForPage(8.5, 11);
    // 11in * 96dpi / 2160 = 0.4889
    expect(scale).toBeCloseTo((11 * 96) / 2160, 4);
    // Width fits within page after scale.
    expect(BOARD_CANVAS.width * scale).toBeLessThanOrEqual(8.5 * 96);
  });

  it("returns a positive ratio <= 1 for standard pages", () => {
    expect(boardScaleForPage(8.5, 11)).toBeGreaterThan(0);
    expect(boardScaleForPage(8.5, 11)).toBeLessThan(1);
  });
});

describe("buildBoardHtml", () => {
  it("emits one .board-page per board", () => {
    const html = buildBoardHtml([makeBoard(1), makeBoard(2)]);
    const matches = html.match(/class="board-page"/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it("includes the LOTERÍA header and TABLA label per board", () => {
    const html = buildBoardHtml([makeBoard(7)]);
    expect(html).toContain("LOTERÍA");
    expect(html).toContain("TABLA 07");
  });

  it("renders 16 cards inside the grid", () => {
    const html = buildBoardHtml([makeBoard(1)]);
    const cardMatches = html.match(/class="card"/g) ?? [];
    expect(cardMatches).toHaveLength(16);
  });

  it("uses Letter @page size by default", () => {
    const html = buildBoardHtml([makeBoard(1)]);
    expect(html).toContain("@page { size: Letter");
  });

  it("uses A4 when requested", () => {
    const html = buildBoardHtml([makeBoard(1)], { pageFormat: "A4" });
    expect(html).toContain("@page { size: A4");
  });

  it("escapes HTML in card names", () => {
    const board = makeBoard(1);
    board.cards[0] = makeCard(1, {
      english_name: "<script>x</script>",
      spanish_name: "Carta & cía",
    });
    const html = buildBoardHtml([board]);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Carta &amp; cía");
  });

  it("includes background-image for cards with image_url", () => {
    const board = makeBoard(1);
    const html = buildBoardHtml([board]);
    expect(html).toContain("background-image: url('https://example.com/1.png')");
  });

  it("omits background-image when image_url is null", () => {
    const board = makeBoard(1);
    board.cards[0] = makeCard(1, { image_url: null });
    const html = buildBoardHtml([board]);
    // The first card div should not have background-image set.
    const firstCard = html.split('class="card"')[1] ?? "";
    const beforeNextCard = firstCard.split('class="card"')[0];
    expect(beforeNextCard).not.toContain("background-image");
  });

  it("rejects boards that do not have exactly 16 cards", () => {
    const bad: ExportBoard = {
      board_number: 1,
      label: "TABLA 01",
      cards: [makeCard(1)],
    };
    expect(() => buildBoardHtml([bad])).toThrow(/16/);
  });

  it("renders the board at 1400x2160 logical pixels", () => {
    const html = buildBoardHtml([makeBoard(1)]);
    expect(html).toContain("width: 1400px");
    expect(html).toContain("height: 2160px");
  });

  it("uses the playbook-specified colors", () => {
    const html = buildBoardHtml([makeBoard(1)]);
    expect(html).toContain("#EEEEEE"); // main board bg
    expect(html).toContain("#F5F5F5"); // header bg
  });
});

describe("buildCallerDeckHtml", () => {
  const cards = Array.from({ length: 54 }, (_, i) => makeCard(i + 1));

  it("renders all 54 cards by default (6 per page = 9 pages)", () => {
    const html = buildCallerDeckHtml(cards);
    const items = html.match(/class="caller-card"/g) ?? [];
    expect(items).toHaveLength(54);
    const pages = html.match(/class="caller-page"/g) ?? [];
    expect(pages).toHaveLength(9);
  });

  it("respects custom cardsPerPage", () => {
    const html = buildCallerDeckHtml(cards, { cardsPerPage: 9 });
    const pages = html.match(/class="caller-page"/g) ?? [];
    expect(pages).toHaveLength(6); // 54/9
  });

  it("includes #01 numbering with zero-pad", () => {
    const html = buildCallerDeckHtml(cards.slice(0, 1));
    expect(html).toContain("#01");
  });

  it("sorts cards by card_number", () => {
    const out = buildCallerDeckHtml([makeCard(54), makeCard(1), makeCard(20)]);
    const idx1 = out.indexOf("#01");
    const idx20 = out.indexOf("#20");
    const idx54 = out.indexOf("#54");
    expect(idx1).toBeLessThan(idx20);
    expect(idx20).toBeLessThan(idx54);
  });
});

describe("buildCardIndexCsv", () => {
  it("includes the header row + one row per card", () => {
    const csv = buildCardIndexCsv([makeCard(1), makeCard(2)]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("card_id,english_name,spanish_name,category,image_path");
    expect(lines).toHaveLength(3);
  });

  it("quotes fields containing commas or quotes", () => {
    const csv = buildCardIndexCsv([
      makeCard(1, { english_name: 'Hello, "world"', spanish_name: "Hola" }),
    ]);
    expect(csv).toContain('"Hello, ""world"""');
  });

  it("emits empty strings for missing category/image", () => {
    const csv = buildCardIndexCsv([makeCard(1, { category: null, image_url: null })]);
    expect(csv).toContain("Card 1,Carta 1,,");
  });

  it("sorts rows by card_number", () => {
    const csv = buildCardIndexCsv([makeCard(3), makeCard(1), makeCard(2)]);
    const lines = csv.trim().split("\n").slice(1);
    expect(lines[0]).toMatch(/^1,/);
    expect(lines[1]).toMatch(/^2,/);
    expect(lines[2]).toMatch(/^3,/);
  });
});

describe("escapeHtml", () => {
  it("escapes the five XML metacharacters", () => {
    expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

describe("slugify", () => {
  it("lowercases and replaces non-alphanum runs with underscore", () => {
    expect(slugify("My Loteria Project!")).toBe("my_loteria_project");
  });

  it("strips diacritics", () => {
    expect(slugify("Lotería Niños")).toBe("loteria_ninos");
  });

  it("falls back to a default when empty", () => {
    expect(slugify("---")).toBe("loteria_project");
  });
});
