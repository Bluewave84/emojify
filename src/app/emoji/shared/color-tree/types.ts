import type { EmojiName } from "./emoji-list";

export type EmojiSize = 32 | 64 | 128 | 256;

export type FileType = "png" | "svg";

export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  id?: number;
}

export interface TreeNodeEmoji {
  emoji: EmojiName;
  oklab: OklabColor;
}

export interface OklabColor {
  l: number; // Lightness (0.0 to 1.0)
  a: number; // green/red axis (-0.4 to 0.4)
  b: number; // blue/yellow axis (-0.4 to 0.4)
}

export interface RGBAColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0.0 bis 1.0 (Transparenz)
}
