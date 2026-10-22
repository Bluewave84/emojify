import { FastAverageColor } from "fast-average-color";
import type { EmojiPart, ImagePart } from "../shared/emoji.service";

export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

export interface BackgroundRemoval {
  color: string;
  /** Percent (0-100) of the maximum RGB distance that still counts as background. */
  tolerance: number;
}

export const SCALE_OPTIONS = [25, 50, 75, 100, 125, 150, 175, 200] as const;

export interface AnalysisOptions {
  adjustments?: ImageAdjustments;
  /** Percent, 100 = original size. */
  scale?: number;
  removeBackground?: BackgroundRemoval | null;
}

const MAX_PIXELS = 16_000_000;
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

export function parseHexColor(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error("Invalid color.");
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Makes every pixel within the tolerance of the given color fully transparent. */
export function removeBackgroundColor(
  data: Uint8ClampedArray,
  { color, tolerance }: BackgroundRemoval,
): void {
  const [tr, tg, tb] = parseHexColor(color);
  const limit = (Math.min(100, Math.max(0, tolerance)) / 100) * MAX_RGB_DISTANCE;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= limit) data[i + 3] = 0;
  }
}

const clamp = (value: number) => Math.min(255, Math.max(0, value));

/** Applies brightness/contrast/saturation (percent, 100 = unchanged) like the CSS filters. */
export function adjustColor(
  value: readonly number[],
  { brightness, contrast, saturation }: ImageAdjustments,
): [number, number, number, number] {
  const b = brightness / 100;
  const c = contrast / 100;
  const s = saturation / 100;
  const [r, g, bl] = value.map((channel) => clamp(channel * b));
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  const out = [r, g, bl].map((channel) =>
    clamp((clamp(gray + (channel - gray) * s) - 127.5) * c + 127.5),
  );
  return [out[0], out[1], out[2], value[3] ?? 255];
}

async function loadImage(
  doc: Document,
  source: string,
  signal?: AbortSignal,
): Promise<HTMLImageElement> {
  signal?.throwIfAborted();
  const image = doc.createElement("img");
  let abort: (() => void) | undefined;
  try {
    image.src = source;
    await Promise.race([
      image.decode(),
      new Promise<never>((_resolve, reject) => {
        abort = () => {
          image.src = "";
          reject(signal?.reason);
        };
        signal?.addEventListener("abort", abort, { once: true });
      }),
    ]);
    signal?.throwIfAborted();
    return image;
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
  }
}

export async function analyzeImageParts(
  doc: Document,
  imageSource: string,
  emojiSize: number,
  signal?: AbortSignal,
  options: AnalysisOptions = {},
): Promise<ImagePart[]> {
  const { adjustments = DEFAULT_ADJUSTMENTS, scale = 100, removeBackground = null } = options;
  const image = await loadImage(doc, imageSource, signal);
  if (!Number.isInteger(emojiSize) || emojiSize <= 0) {
    throw new Error("Invalid emoji size.");
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Invalid scale.");
  if (image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
    throw new Error("Das Bild darf maximal 16 Megapixel haben.");
  }
  const width = Math.max(1, Math.round((image.naturalWidth * scale) / 100));
  const height = Math.max(1, Math.round((image.naturalHeight * scale) / 100));
  if (width * height > MAX_PIXELS) {
    throw new Error("Das skalierte Bild darf maximal 16 Megapixel haben.");
  }
  const source = doc.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Failed to get 2D context.");
  sourceContext.drawImage(image, 0, 0, width, height);
  if (removeBackground) {
    const pixels = sourceContext.getImageData(0, 0, width, height);
    removeBackgroundColor(pixels.data, removeBackground);
    sourceContext.putImageData(pixels, 0, 0);
  }
  const canvas = doc.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Failed to get 2D context.");
  const averageColor = new FastAverageColor();
  const parts: ImagePart[] = [];

  try {
    const rows = Math.ceil(height / emojiSize);
    const cols = Math.ceil(width / emojiSize);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        signal?.throwIfAborted();
        const sourceX = col * emojiSize;
        const sourceY = row * emojiSize;
        canvas.width = Math.min(emojiSize, width - sourceX);
        canvas.height = Math.min(emojiSize, height - sourceY);
        if (removeBackground) {
          const data = sourceContext.getImageData(
            sourceX,
            sourceY,
            canvas.width,
            canvas.height,
          ).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let opaque = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            opaque++;
          }
          if (opaque * 2 < data.length / 4) {
            parts.push({ row, col, color: [0, 0, 0, 0] });
          } else {
            parts.push({
              row,
              col,
              color: adjustColor([r / opaque, g / opaque, b / opaque, 255], adjustments),
            });
          }
          continue;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          source,
          sourceX,
          sourceY,
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const color = averageColor.getColor(canvas, { algorithm: "sqrt" });
        if (color.error) throw color.error;
        parts.push({ row, col, color: adjustColor(color.value, adjustments) });
      }
      if (row % 16 === 0) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }
    return parts;
  } finally {
    averageColor.destroy();
    canvas.width = canvas.height = 0;
    source.width = source.height = 0;
  }
}

export function extractEmojiSvg(sprite: Document, emoji: string): string {
  const source = sprite.getElementById(`emoji_u${emoji}`);
  if (!source || source.localName !== "svg") {
    throw new Error(`Emoji artwork not found: ${emoji}`);
  }
  const image = source.cloneNode(true) as Element;
  image.removeAttribute("x");
  image.removeAttribute("y");
  return new XMLSerializer().serializeToString(image);
}

export async function createEmojiImage(
  doc: Document,
  parts: EmojiPart[],
  emojiSize: number,
  spriteText: string,
  signal?: AbortSignal,
  backgroundColor: string | null = "#000000",
  grid?: { rows: number; cols: number },
  monochrome = false,
): Promise<string> {
  signal?.throwIfAborted();
  if (parts.length === 0) throw new Error("Cannot render an empty mosaic.");
  const sprite = new DOMParser().parseFromString(spriteText, "image/svg+xml");
  if (sprite.querySelector("parsererror") || sprite.documentElement.localName !== "svg") {
    throw new Error("Invalid emoji sprite.");
  }
  const canvas = doc.createElement("canvas");
  let rows = 0;
  let cols = 0;
  for (const part of parts) {
    rows = Math.max(rows, part.row + 1);
    cols = Math.max(cols, part.col + 1);
  }
  if (grid) {
    rows = Math.max(rows, grid.rows);
    cols = Math.max(cols, grid.cols);
  }
  canvas.width = cols * emojiSize;
  canvas.height = rows * emojiSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get 2D context.");
  if (backgroundColor !== null) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const images = new Map<string, HTMLImageElement>();
  try {
    for (const part of parts) {
      signal?.throwIfAborted();
      let image = images.get(part.emoji);
      if (!image) {
        const source = URL.createObjectURL(
          new Blob([extractEmojiSvg(sprite, part.emoji)], {
            type: "image/svg+xml",
          }),
        );
        try {
          image = await loadImage(doc, source, signal);
          images.set(part.emoji, image);
        } finally {
          URL.revokeObjectURL(source);
        }
      }
      context.filter = monochrome ? "brightness(0) invert(1)" : "none";
      context.drawImage(image, part.col * emojiSize, part.row * emojiSize, emojiSize, emojiSize);
    }
    const result = canvas.toDataURL("image/png");
    if (!result.startsWith("data:image/png")) throw new Error("PNG export failed.");
    return result;
  } finally {
    images.clear();
    canvas.width = canvas.height = 0;
  }
}

/**
 * Turns an `#rrggbbaa` (or `#rrggbb`) value into a canvas fill. A fully transparent
 * value yields `null`, which leaves the mosaic background transparent.
 */
export function backgroundFill(hexa: string): string | null {
  const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hexa.trim());
  if (!match) throw new Error("Invalid color.");
  const alpha = match[2] === undefined ? 255 : parseInt(match[2], 16);
  if (alpha === 0) return null;
  if (alpha === 255) return `#${match[1].toLowerCase()}`;
  const [r, g, b] = parseHexColor(match[1]);
  return `rgba(${r}, ${g}, ${b}, ${Math.round((alpha / 255) * 1000) / 1000})`;
}

/** Alpha of an `#rrggbbaa` value as 0-255; `#rrggbb` counts as opaque. */
export function backgroundAlpha(hexa: string): number {
  const match = /^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.exec(hexa.trim());
  return match?.[1] === undefined ? 255 : parseInt(match[1], 16);
}

const toHex = (value: number) => value.toString(16).padStart(2, "0");

/** Reads the color of one pixel, given as fractions (0-1) of the image width and height. */
export async function sampleColor(
  doc: Document,
  imageSource: string,
  x: number,
  y: number,
): Promise<string> {
  const image = await loadImage(doc, imageSource);
  const canvas = doc.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Failed to get 2D context.");
  const px = Math.min(image.naturalWidth - 1, Math.max(0, Math.floor(x * image.naturalWidth)));
  const py = Math.min(image.naturalHeight - 1, Math.max(0, Math.floor(y * image.naturalHeight)));
  context.drawImage(image, px, py, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const PREVIEW_MAX_SIDE = 1200;

/** Renders a downscaled preview of the image with the background color cut out. */
export async function renderBackgroundPreview(
  doc: Document,
  imageSource: string,
  removal: BackgroundRemoval,
  signal?: AbortSignal,
): Promise<string> {
  const image = await loadImage(doc, imageSource, signal);
  const ratio = Math.min(1, PREVIEW_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = doc.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Failed to get 2D context.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    signal?.throwIfAborted();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    removeBackgroundColor(pixels.data, removal);
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    canvas.width = canvas.height = 0;
  }
}
