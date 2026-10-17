import fs from "node:fs/promises";
import { decodePng } from "@lunapaint/png-codec";
import type { RGBColor } from "../../src/app/emoji/shared/color-tree/types";

export interface EmojiAnalysis {
  /** Average color of all pixels that are not fully transparent. */
  color: RGBColor;
  width: number;
  height: number;
  /** Share of pixels that are not fully transparent (0-1). */
  coverage: number;
  /** Share of visible pixels that are only partly opaque (0-1), e.g. anti-aliased edges. */
  partialAlpha: number;
}

export const analyzeEmojiFile = async (filePath: string): Promise<EmojiAnalysis | null> => {
  const decoded = await decodePng(await fs.readFile(filePath));
  return analyzeRgba(decoded.image.data, decoded.image.width, decoded.image.height);
};

/** Returns null when the image has no visible pixels. */
export const analyzeRgba = (
  data: ArrayLike<number>,
  width: number,
  height: number,
): EmojiAnalysis | null => {
  let red = 0;
  let green = 0;
  let blue = 0;
  let visiblePixels = 0;
  let partialPixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) {
      continue;
    }

    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    visiblePixels += 1;
    if (alpha < 255) {
      partialPixels += 1;
    }
  }

  if (visiblePixels === 0) {
    return null;
  }

  const rnd = (channel: number) => Math.round(channel / visiblePixels);

  return {
    color: { r: rnd(red), g: rnd(green), b: rnd(blue) },
    width,
    height,
    coverage: visiblePixels / (width * height),
    partialAlpha: partialPixels / visiblePixels,
  };
};
