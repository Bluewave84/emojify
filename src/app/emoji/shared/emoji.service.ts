import { HttpClient } from "@angular/common/http";
import { computed, inject, Service, signal } from "@angular/core";
import { catchError, map, of } from "rxjs";
import { OklabKDTree } from "./color-tree/oklab-kd-tree";
import { toSignal } from "@angular/core/rxjs-interop";
import { EMOJIS } from "./color-tree/emoji-list";
import { flattenAlphaOnWhite } from "./color-tree/utils";

export interface ImagePart {
  row: number;
  col: number;
  color: [number, number, number, number];
}
export interface EmojiPart {
  row: number;
  col: number;
  emoji: string;
}

export type EmojiSelectionMode = "best" | "random" | "roundRobin";

export interface EmojiSelection {
  mode: EmojiSelectionMode;
  /** Number of closest emojis to choose from for "random" and "roundRobin". */
  topN: number;
}

export const DEFAULT_SELECTION: EmojiSelection = { mode: "best", topN: 5 };

export interface TreeBinary {
  rootIndex: number;
  buffer: ArrayBuffer | SharedArrayBuffer;
}

@Service()
export class EmojiService {
  private readonly loadError = signal<string | null>(null);
  readonly error = this.loadError.asReadonly();

  private readonly kdTree = toSignal(
    inject(HttpClient)
      .get("emojiKdTree.bin", { responseType: "arraybuffer" })
      .pipe(
        map((buffer) => {
          if (buffer.byteLength === 0 || buffer.byteLength % (6 * Float64Array.BYTES_PER_ELEMENT)) {
            throw new Error("Invalid emoji tree binary.");
          }
          return OklabKDTree.fromBinary({ rootIndex: 0, buffer });
        }),
        catchError(() => {
          this.loadError.set("Emoji-Farbdaten konnten nicht geladen werden.");
          return of(null);
        }),
      ),
  );

  readonly ready = computed(() => !!this.kdTree());

  emojify(
    imageParts: ImagePart[],
    selection: EmojiSelection = DEFAULT_SELECTION,
    random: () => number = Math.random,
  ): EmojiPart[] {
    const tree = this.kdTree();
    if (!tree) {
      throw new Error("KD-Tree not loaded yet.");
    }
    const count = selection.mode === "best" ? 1 : Math.max(1, Math.floor(selection.topN) || 1);
    return imageParts.map((part, index) => {
      const [red, green, blue, alpha] = part.color;
      const candidates = tree.findNearestColors(
        flattenAlphaOnWhite({ r: red, g: green, b: blue, a: alpha / 255 }),
        count,
      );
      if (candidates.length === 0) {
        throw new Error("No matching emoji found.");
      }
      let pick = 0;
      if (selection.mode === "random") {
        pick = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
      } else if (selection.mode === "roundRobin") {
        pick = index % candidates.length;
      }
      const emoji = EMOJIS[candidates[pick].id];
      if (!emoji) {
        throw new Error("Unknown emoji ID.");
      }
      return { row: part.row, col: part.col, emoji };
    });
  }
}
