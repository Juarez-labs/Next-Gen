// Server-side Lotería card renderer.
//
// Renders the final card frame with app-controlled text — the AI artwork
// fills the central panel but card number, English name, and Spanish name
// are always drawn by us (playbook 3.1: "do not rely on AI to render text").
//
// Default canvas: @napi-rs/canvas, loaded lazily so unit tests for the pure
// layout helpers run without the native dep installed.

import type { Database } from "@/lib/supabase/types";

type CardRow = Database["public"]["Tables"]["cards"]["Row"];

export const FINAL_CARD_WIDTH = 600;
export const FINAL_CARD_HEIGHT = 900;
export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_HEIGHT = 450;

const ART_HEIGHT_FRACTION = 0.6;

export interface CardLayout {
  width: number;
  height: number;
  border: { x: number; y: number; width: number; height: number; lineWidth: number };
  numberBox: { x: number; y: number; size: number; fontSize: number };
  englishName: { x: number; y: number; maxWidth: number; fontSize: number };
  spanishName: { x: number; y: number; maxWidth: number; fontSize: number };
  artwork: { x: number; y: number; width: number; height: number };
  background: string;
  borderColor: string;
  textColor: string;
}

export interface RenderCardOptions {
  width?: number;
  height?: number;
  background?: string;
  borderColor?: string;
  textColor?: string;
  fontFamily?: string;
}

/**
 * Pure layout helper — returns geometry only, no canvas calls.
 * Kept separate so it can be unit-tested without the native canvas dep.
 */
export function computeCardLayout(opts: RenderCardOptions = {}): CardLayout {
  const width = opts.width ?? FINAL_CARD_WIDTH;
  const height = opts.height ?? FINAL_CARD_HEIGHT;

  // Scale all measurements by card width so thumbnails come out proportional.
  const scale = width / FINAL_CARD_WIDTH;
  const padding = Math.round(24 * scale);
  const borderLine = Math.max(4, Math.round(6 * scale));

  const numberSize = Math.round(56 * scale);
  const numberFontSize = Math.round(28 * scale);

  const englishFontSize = Math.round(32 * scale);
  const spanishFontSize = Math.round(34 * scale);

  // English name row sits below the number box.
  const englishY = padding + Math.round(numberSize / 2) + Math.round(8 * scale);

  // Spanish name row sits inside the bottom padding.
  const spanishY = height - padding - Math.round(8 * scale);

  // Artwork panel: centered, fills ART_HEIGHT_FRACTION of card height.
  const artHeight = Math.round(height * ART_HEIGHT_FRACTION);
  const artWidth = width - padding * 2;
  const artX = padding;
  const artY = Math.round((height - artHeight) / 2);

  return {
    width,
    height,
    border: {
      x: borderLine / 2,
      y: borderLine / 2,
      width: width - borderLine,
      height: height - borderLine,
      lineWidth: borderLine,
    },
    numberBox: {
      x: padding,
      y: padding,
      size: numberSize,
      fontSize: numberFontSize,
    },
    englishName: {
      x: width / 2,
      y: englishY,
      maxWidth: width - padding * 2 - numberSize - padding,
      fontSize: englishFontSize,
    },
    spanishName: {
      x: width / 2,
      y: spanishY,
      maxWidth: width - padding * 2,
      fontSize: spanishFontSize,
    },
    artwork: {
      x: artX,
      y: artY,
      width: artWidth,
      height: artHeight,
    },
    background: opts.background ?? "#fdf6e3",
    borderColor: opts.borderColor ?? "#111111",
    textColor: opts.textColor ?? "#111111",
  };
}

/**
 * Loadable artwork — either a remote URL, raw bytes, or null to skip.
 */
export type ArtworkSource =
  | { kind: "url"; url: string }
  | { kind: "buffer"; data: Uint8Array }
  | { kind: "none" };

function formatCardNumber(n: number): string {
  return n.toString().padStart(2, "0");
}

// Lazy resolver so importing this module on the client / in a test without
// the native dep does not blow up. Server callers must install
// `@napi-rs/canvas` (added to package.json).
async function loadCanvasLib() {
  try {
    const mod = await import("@napi-rs/canvas");
    return mod;
  } catch {
    throw new Error(
      "card-renderer: @napi-rs/canvas is not installed. Run `npm install` in loteria/ to add the native renderer.",
    );
  }
}

export interface RenderedCard {
  /** PNG bytes. */
  png: Buffer;
  width: number;
  height: number;
}

/**
 * Render a finished card (600x900 by default) as a PNG buffer.
 *
 * Card art is sourced from `art`. When `art.kind === 'none'` the artwork
 * panel is rendered as a placeholder rectangle so the layout still passes
 * QA — useful before Higgsfield jobs return.
 */
export async function renderCardPng(
  card: Pick<CardRow, "card_number" | "english_name" | "spanish_name">,
  art: ArtworkSource,
  opts: RenderCardOptions = {},
): Promise<RenderedCard> {
  const layout = computeCardLayout(opts);
  const { createCanvas, loadImage } = await loadCanvasLib();
  const canvas = createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");

  // Background.
  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Artwork panel.
  if (art.kind !== "none") {
    let imageData: unknown;
    if (art.kind === "url") {
      imageData = await loadImage(art.url);
    } else {
      imageData = await loadImage(Buffer.from(art.data));
    }
    drawImageCover(
      ctx as unknown as DrawingCtx,
      imageData as DrawableImage,
      layout.artwork.x,
      layout.artwork.y,
      layout.artwork.width,
      layout.artwork.height,
    );
  } else {
    ctx.fillStyle = "#f0e7c8";
    ctx.fillRect(
      layout.artwork.x,
      layout.artwork.y,
      layout.artwork.width,
      layout.artwork.height,
    );
    ctx.strokeStyle = "#d4c79a";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      layout.artwork.x,
      layout.artwork.y,
      layout.artwork.width,
      layout.artwork.height,
    );
  }

  // Outer border.
  ctx.strokeStyle = layout.borderColor;
  ctx.lineWidth = layout.border.lineWidth;
  ctx.strokeRect(
    layout.border.x,
    layout.border.y,
    layout.border.width,
    layout.border.height,
  );

  // Card number box (top-left).
  ctx.fillStyle = layout.borderColor;
  ctx.fillRect(
    layout.numberBox.x,
    layout.numberBox.y,
    layout.numberBox.size,
    layout.numberBox.size,
  );
  ctx.fillStyle = layout.background;
  ctx.font = `bold ${layout.numberBox.fontSize}px ${opts.fontFamily ?? "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    formatCardNumber(card.card_number),
    layout.numberBox.x + layout.numberBox.size / 2,
    layout.numberBox.y + layout.numberBox.size / 2,
  );

  // English name (top center).
  ctx.fillStyle = layout.textColor;
  ctx.font = `600 ${layout.englishName.fontSize}px ${opts.fontFamily ?? "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    card.english_name,
    layout.englishName.x,
    layout.englishName.y,
    layout.englishName.maxWidth,
  );

  // Spanish name (bottom center).
  ctx.font = `bold ${layout.spanishName.fontSize}px ${opts.fontFamily ?? "serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    card.spanish_name,
    layout.spanishName.x,
    layout.spanishName.y,
    layout.spanishName.maxWidth,
  );

  const png = await canvas.encode("png");
  return { png: Buffer.from(png), width: layout.width, height: layout.height };
}

/**
 * Render a board-preview thumbnail (300x450 by default).
 */
export function renderCardThumbnail(
  card: Pick<CardRow, "card_number" | "english_name" | "spanish_name">,
  art: ArtworkSource,
  opts: Omit<RenderCardOptions, "width" | "height"> = {},
): Promise<RenderedCard> {
  return renderCardPng(card, art, {
    ...opts,
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
  });
}

// --- Internal helpers --------------------------------------------------

interface DrawableImage {
  width: number;
  height: number;
}

interface DrawingCtx {
  drawImage: (
    img: DrawableImage,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => void;
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  clip: () => void;
}

/**
 * Draw an image into the target rect using "cover" semantics — scale up
 * to fill, center, and clip overflow. Mirrors CSS `object-fit: cover`.
 */
function drawImageCover(
  ctx: DrawingCtx,
  image: DrawableImage,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const srcAspect = image.width / image.height;
  const dstAspect = dw / dh;

  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (srcAspect > dstAspect) {
    // Source is wider than dest — crop horizontally.
    sw = image.height * dstAspect;
    sx = (image.width - sw) / 2;
  } else if (srcAspect < dstAspect) {
    // Source is taller than dest — crop vertically.
    sh = image.width / dstAspect;
    sy = (image.height - sh) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

// Re-exported for tests + downstream callers that want the geometry only.
export { drawImageCover as __internal_drawImageCover };
