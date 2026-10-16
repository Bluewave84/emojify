import { FastAverageColor } from "fast-average-color";
import type { EmojiPart, ImagePart } from "../shared/emoji.service";

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
): Promise<ImagePart[]> {
  const image = await loadImage(doc, imageSource, signal);
  if (!Number.isInteger(emojiSize) || emojiSize <= 0) {
    throw new Error("Invalid emoji size.");
  }
  if (image.naturalWidth * image.naturalHeight > 16_000_000) {
    throw new Error("Das Bild darf maximal 16 Megapixel haben.");
  }
  const canvas = doc.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Failed to get 2D context.");
  const averageColor = new FastAverageColor();
  const parts: ImagePart[] = [];

  try {
    const rows = Math.ceil(image.naturalHeight / emojiSize);
    const cols = Math.ceil(image.naturalWidth / emojiSize);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        signal?.throwIfAborted();
        const sourceX = col * emojiSize;
        const sourceY = row * emojiSize;
        canvas.width = Math.min(emojiSize, image.naturalWidth - sourceX);
        canvas.height = Math.min(emojiSize, image.naturalHeight - sourceY);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          image,
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
        parts.push({ row, col, color: color.value });
      }
      if (row % 16 === 0) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }
    return parts;
  } finally {
    averageColor.destroy();
    canvas.width = canvas.height = 0;
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
  canvas.width = cols * emojiSize;
  canvas.height = rows * emojiSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get 2D context.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

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
