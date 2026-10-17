import fs from "node:fs/promises";
import path from "node:path";
import { EMOJI_LIST, type EmojiName } from "../../src/app/emoji/shared/color-tree/emoji-list";
import { OklabKDTree } from "../../src/app/emoji/shared/color-tree/oklab-kd-tree";
import type { OklabColor, RGBColor } from "../../src/app/emoji/shared/color-tree/types";
import { rgbToOklab } from "../../src/app/emoji/shared/color-tree/utils";
import { analyzeEmojiFile, type EmojiAnalysis } from "./analyze";

export interface GenerateOptions {
  /** noto-emoji checkout, one of its style folders (2D/3D), or a folder of emoji_u*.png files. */
  source: string;
  style: string;
  size: number;
  concurrency: number;
  verifySamples: number;
}

export interface TreeEmoji extends EmojiAnalysis {
  id: number;
  name: EmojiName;
  file: string;
  oklab: OklabColor;
  /** Closest other emoji in the tree, by Oklab distance. */
  nearest: { id: number; name: EmojiName; distance: number } | null;
  /** Set when a lookup of this emoji's own color returns another emoji, so it can never be picked. */
  shadowedBy: { id: number; name: EmojiName } | null;
}

export interface GenerateResult {
  pngDir: string;
  tree: OklabKDTree;
  emojis: TreeEmoji[];
  missing: { id: number; name: EmojiName; file: string }[];
  empty: { id: number; name: EmojiName; file: string }[];
  /** PNGs in the source folder that are not in EMOJI_LIST, so they never reach the tree. */
  unlisted: string[];
  verification: { samples: number; mismatches: number };
  timings: { analyzeMs: number; buildMs: number; insightsMs: number };
}

const FILE_PREFIX = "emoji_u";

export const generateEmojiColorTree = async (
  options: GenerateOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<GenerateResult> => {
  const pngDir = await resolvePngDir(options);
  const files = new Set((await fs.readdir(pngDir)).filter((file) => file.endsWith(".png")));

  const missing: GenerateResult["missing"] = [];
  const empty: GenerateResult["empty"] = [];
  const analyzed: Omit<TreeEmoji, "nearest" | "shadowedBy">[] = [];

  let start = performance.now();
  let done = 0;
  await forEachLimit(EMOJI_LIST, options.concurrency, async (name, id) => {
    const file = `${FILE_PREFIX}${name}.png`;
    if (!files.has(file)) {
      missing.push({ id, name, file });
    } else {
      const analysis = await analyzeEmojiFile(path.join(pngDir, file));
      if (analysis) {
        analyzed.push({ id, name, file, oklab: rgbToOklab(analysis.color), ...analysis });
      } else {
        empty.push({ id, name, file });
      }
    }
    done += 1;
    onProgress?.(done, EMOJI_LIST.length);
  });
  const analyzeMs = performance.now() - start;

  // Keep list order so the tree layout doesn't depend on which file finished decoding first.
  analyzed.sort((x, y) => x.id - y.id);
  missing.sort((x, y) => x.id - y.id);
  empty.sort((x, y) => x.id - y.id);

  start = performance.now();
  const tree = new OklabKDTree(analyzed.map(({ id, color }) => ({ id, color })));
  const buildMs = performance.now() - start;

  start = performance.now();
  const byId = new Map(analyzed.map((emoji) => [emoji.id, emoji]));
  const emojis: TreeEmoji[] = analyzed.map((emoji) => {
    const hit = tree.findNearestColor(emoji.color);
    const shadow = hit && hit.id !== emoji.id ? byId.get(hit.id) : undefined;
    return {
      ...emoji,
      nearest: findNearestOther(emoji, analyzed),
      shadowedBy: shadow ? { id: shadow.id, name: shadow.name } : null,
    };
  });

  const listed = new Set(EMOJI_LIST.map((name) => `${FILE_PREFIX}${name}.png`));
  const unlisted = [...files].filter((file) => !listed.has(file)).sort();
  const verification = verifyTree(tree, analyzed, options.verifySamples);
  const insightsMs = performance.now() - start;

  return {
    pngDir,
    tree,
    emojis,
    missing,
    empty,
    unlisted,
    verification,
    timings: { analyzeMs, buildMs, insightsMs },
  };
};

/** Accepts the noto-emoji root, a style folder like `2D`, or the PNG folder itself. */
const resolvePngDir = async ({ source, style, size }: GenerateOptions): Promise<string> => {
  const candidates = [
    path.join(source, style, "png", String(size)),
    path.join(source, "png", String(size)),
    source,
  ];
  for (const candidate of candidates) {
    const entries = await fs.readdir(candidate).catch(() => null);
    if (entries?.some((file) => file.startsWith(FILE_PREFIX) && file.endsWith(".png"))) {
      return candidate;
    }
  }
  throw new Error(
    `No ${FILE_PREFIX}*.png files found. Looked in:\n${candidates.map((c) => `  ${c}`).join("\n")}`,
  );
};

const distance = (x: OklabColor, y: OklabColor) =>
  Math.sqrt((x.l - y.l) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2);

const findNearestOther = (
  emoji: { id: number; oklab: OklabColor },
  all: { id: number; name: EmojiName; oklab: OklabColor }[],
): TreeEmoji["nearest"] => {
  let best: TreeEmoji["nearest"] = null;
  for (const other of all) {
    if (other.id === emoji.id) continue;
    const d = distance(emoji.oklab, other.oklab);
    if (!best || d < best.distance) {
      best = { id: other.id, name: other.name, distance: d };
    }
  }
  return best;
};

/** Compares tree lookups for random colors against a brute-force search. */
const verifyTree = (
  tree: OklabKDTree,
  emojis: { oklab: OklabColor }[],
  samples: number,
): GenerateResult["verification"] => {
  let mismatches = 0;
  for (let index = 0; index < samples; index += 1) {
    const rgb: RGBColor = {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256),
    };
    const target = rgbToOklab(rgb);
    const hit = tree.findNearestColor(rgb);
    const best = Math.min(...emojis.map((emoji) => distance(target, emoji.oklab)));
    if (!hit || Math.abs(Math.sqrt(hit.squaredOklabDistance) - best) > 1e-9) {
      mismatches += 1;
    }
  }
  return { samples, mismatches };
};

const forEachLimit = async <T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
};
