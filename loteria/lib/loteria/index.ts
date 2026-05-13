// Public entry point for the Lotería board generator + validator.

export * from "./types";
export { createRng } from "./rng";
export { generateBoards } from "./board-generator";
export { validateBoard, validateBoardSet } from "./validator";
export {
  loadCardLookup,
  mapCardNumbersToIds,
  persistBoardSet,
} from "./persistence";
export {
  HiggsfieldClient,
  buildCardPrompt,
  createHiggsfieldClientFromEnv,
} from "./higgsfield";
export type {
  HiggsfieldJob,
  HiggsfieldJobStatus,
  HiggsfieldClientOptions,
  TextToImageRequest,
  ImageToImageRequest,
} from "./higgsfield";
export {
  FINAL_CARD_WIDTH,
  FINAL_CARD_HEIGHT,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  computeCardLayout,
  renderCardPng,
  renderCardThumbnail,
} from "./card-renderer";
export type { CardLayout, RenderCardOptions, ArtworkSource, RenderedCard } from "./card-renderer";
