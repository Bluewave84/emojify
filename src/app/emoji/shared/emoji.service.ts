import { HttpClient } from "@angular/common/http";
import { computed, inject, Service, signal } from "@angular/core";
import { catchError, map, of } from "rxjs";
import { OklabKDTree } from "./color-tree/oklab-kd-tree";
import { toSignal } from "@angular/core/rxjs-interop";
import { EMOJIS } from "./color-tree/emoji-list";
import { flattenAlphaOnWhite } from "./color-tree/utils";

export type ImagePart = { row: number; col: number; color: [number, number, number, number] };
export type EmojiPart = { row: number; col: number; emoji: string };

export type TreeBinary = {
  rootIndex: number;
  buffer: ArrayBuffer | SharedArrayBuffer;
};

@Service()
export class EmojiService {
  private readonly loadError = signal<string | null>(null);
  readonly error = this.loadError.asReadonly();

  private readonly kdTree = toSignal(
    inject(HttpClient)
      .get("/emojiKdTree.bin", { responseType: "arraybuffer" })
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

  emojify(imageParts: ImagePart[]): EmojiPart[] {
    const tree = this.kdTree();
    if (!tree) {
      throw new Error("KD-Tree not loaded yet.");
    }
    const resultParts: EmojiPart[] = [];
    imageParts.forEach((part) => {
      const [red, green, blue, alpha] = part.color;
      const treeNode = tree.findNearestColor(
        flattenAlphaOnWhite({ r: red, g: green, b: blue, a: alpha / 255 }),
      );
      if (!treeNode) {
        throw new Error("No matching emoji found.");
      }
      const emoji = EMOJIS[treeNode.id];
      if (!emoji) {
        throw new Error("Unknown emoji ID.");
      }
      resultParts.push({ row: part.row, col: part.col, emoji });
    });
    return resultParts;
  }
}
