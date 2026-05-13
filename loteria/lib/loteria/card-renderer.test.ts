import { describe, expect, it } from "vitest";

import {
  FINAL_CARD_HEIGHT,
  FINAL_CARD_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
  computeCardLayout,
} from "./card-renderer";

describe("computeCardLayout", () => {
  it("defaults to 600x900 with art panel ~60% of card height", () => {
    const layout = computeCardLayout();
    expect(layout.width).toBe(FINAL_CARD_WIDTH);
    expect(layout.height).toBe(FINAL_CARD_HEIGHT);

    const artFraction = layout.artwork.height / layout.height;
    expect(artFraction).toBeCloseTo(0.6, 5);
  });

  it("places the number box in the top-left inside the padding", () => {
    const layout = computeCardLayout();
    expect(layout.numberBox.x).toBeGreaterThan(0);
    expect(layout.numberBox.y).toBeGreaterThan(0);
    expect(layout.numberBox.x + layout.numberBox.size).toBeLessThan(
      layout.width / 2,
    );
  });

  it("centers the artwork horizontally inside the card padding", () => {
    const layout = computeCardLayout();
    const leftMargin = layout.artwork.x;
    const rightMargin = layout.width - (layout.artwork.x + layout.artwork.width);
    expect(leftMargin).toBe(rightMargin);
  });

  it("scales geometry proportionally for the thumbnail size", () => {
    const small = computeCardLayout({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
    });
    const big = computeCardLayout();

    // Thumbnail is exactly half size, so derived sizes should scale ~1:2.
    expect(small.artwork.width * 2).toBe(big.artwork.width);
    expect(small.artwork.height * 2).toBe(big.artwork.height);
    expect(small.numberBox.size * 2).toBe(big.numberBox.size);
  });

  it("uses cream background and black border by default", () => {
    const layout = computeCardLayout();
    expect(layout.background).toBe("#fdf6e3");
    expect(layout.borderColor).toBe("#111111");
  });

  it("respects overrides for colors", () => {
    const layout = computeCardLayout({
      background: "#ffffff",
      borderColor: "#000000",
    });
    expect(layout.background).toBe("#ffffff");
    expect(layout.borderColor).toBe("#000000");
  });
});
