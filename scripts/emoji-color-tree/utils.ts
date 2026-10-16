import fs from "node:fs/promises";
import type { EmojiSize, FileType, OklabColor, RGBAColor, RGBColor } from "./types";
import { EMOJIS, type EmojiName } from "./emoji-list";
import { decodePng } from "@lunapaint/png-codec";
import { OklabKDTree } from "./oklab-kd-tree";

export const generateEmojiColorTree = async (root: string) => {
  const emojiValues = Object.values(EMOJIS);
  const emojis: { id: number; color: RGBColor }[] = await Promise.all(
    emojiValues.map(async (value, index) => {
      const path = getEmojiFilePath({ root, fileType: "png", size: 32, name: value });
      const color = await analyzeEmoji(path);

      return {
        id: index,
        color: color,
      };
    }),
  );

  const tree = new OklabKDTree(emojis);
  const treeBinary = tree.exportBinary();
  var length = treeBinary.buffer.byteLength;

  // Write the binary data to ./public/emojiKdTree.bin
  try {
    await fs.writeFile("./public/emojiKdTree.bin", new Uint8Array(treeBinary.buffer));
  } catch (error) {
    console.error("Error writing emoji color tree binary file:", error);
  }
};

async function decodePngFile(filepath: string) {
  const data = await fs.readFile(filepath);
  const decoded = await decodePng(data);
  return decoded;
}

async function analyzeEmoji(filepath: string): Promise<RGBColor> {
  const decoded = await decodePngFile(filepath);
  let red = 0;
  let green = 0;
  let blue = 0;
  let visiblePixels = 0;

  const { data } = decoded.image;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue;
    }

    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    visiblePixels += 1;
  }

  if (visiblePixels === 0) {
    throw new Error("The PNG contains no visible pixels.");
  }

  const rnd = (channel: number) => Math.round(channel / visiblePixels);

  return { r: rnd(red), g: rnd(green), b: rnd(blue) };
}

export const getEmojiFilePath = ({
  root,
  fileType,
  size,
  name,
}: {
  root: string;
  fileType: FileType;
  size: EmojiSize;
  name: EmojiName;
}) => {
  return `${root}/${fileType}/${size}/emoji_u${name}.${fileType}`;
};

export function flattenAlphaOnWhite(rgba: RGBAColor): RGBColor {
  // Wenn voll deckend, können wir die teure Konvertierung überspringen
  if (rgba.a >= 1.0) {
    return { r: rgba.r, g: rgba.g, b: rgba.b };
  }
  // Wenn voll transparent, ist das Ergebnis auf Weiß immer reines Weiß
  if (rgba.a <= 0.0) {
    return { r: 255, g: 255, b: 255 };
  }

  // 1. In den linearen Raum konvertieren (0.0 bis 1.0)
  let rLin = rgba.r / 255;
  let gLin = rgba.g / 255;
  let bLin = rgba.b / 255;

  rLin = rLin > 0.04045 ? Math.pow((rLin + 0.055) / 1.055, 2.4) : rLin / 12.92;
  gLin = gLin > 0.04045 ? Math.pow((gLin + 0.055) / 1.055, 2.4) : gLin / 12.92;
  bLin = bLin > 0.04045 ? Math.pow((bLin + 0.055) / 1.055, 2.4) : bLin / 12.92;

  // 2. Alpha-Blending gegen Weiß (Weiß im linearen Raum ist 1.0)
  const alpha = rgba.a;
  const invAlpha = 1.0 - alpha;

  const rOutLin = rLin * alpha + 1.0 * invAlpha;
  const gOutLin = gLin * alpha + 1.0 * invAlpha;
  const bOutLin = bLin * alpha + 1.0 * invAlpha;

  // 3. Zurück in den Standard-sRGB-Raum konvertieren (Gamma-Kompression)
  const rSRGB =
    rOutLin > 0.0031308 ? 1.055 * Math.pow(rOutLin, 1.0 / 2.4) - 0.055 : rOutLin * 12.92;
  const gSRGB =
    gOutLin > 0.0031308 ? 1.055 * Math.pow(gOutLin, 1.0 / 2.4) - 0.055 : gOutLin * 12.92;
  const bSRGB =
    bOutLin > 0.0031308 ? 1.055 * Math.pow(bOutLin, 1.0 / 2.4) - 0.055 : bOutLin * 12.92;

  // 4. Auf 0-255 skalieren und runden
  return {
    r: Math.max(0, Math.min(255, Math.round(rSRGB * 255))),
    g: Math.max(0, Math.min(255, Math.round(gSRGB * 255))),
    b: Math.max(0, Math.min(255, Math.round(bSRGB * 255))),
  };
}

/**
 * Converts sRGB (0-255) to the perceptually uniform Oklab color space.
 */
export function rgbToOklab(rgb: RGBColor): OklabColor {
  // 1. Linearize sRGB (remove gamma correction)
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // 2. Convert to LMS color space (long, medium, short cone responses)
  const l_pre = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_pre = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_pre = 0.0883024619 * r + 0.2817188376 * g + 0.6261798161 * b;

  // 3. Apply non-linear cube root response to cone signals
  const l_root = Math.cbrt(l_pre);
  const m_root = Math.cbrt(m_pre);
  const s_root = Math.cbrt(s_pre);

  // 4. Transform to Oklab coordinates (L, a, b)
  return {
    l: 0.2104542553 * l_root + 0.793617785 * m_root - 0.0040720468 * s_root,
    a: 1.9779984951 * l_root - 2.428592205 * m_root + 0.4505937099 * s_root,
    b: 0.0259040371 * l_root + 0.7827717662 * m_root - 0.808675766 * s_root,
  };
}
