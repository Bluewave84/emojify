import { Service } from "@angular/core";
import localforage from "localforage";
import { analyzeEmoji } from "./canvas-mean";
import { EMOJIS, getEmojiFilePath } from "./emoji-index";
import { RGBColor, OklabKDTree } from "./kd-tree";

export type TreeBinary = {
  rootIndex: number;
  buffer: ArrayBuffer | SharedArrayBuffer;
};

@Service()
export class EmojiService {
  private tree?: OklabKDTree;

  async trainKdTree(
    progressCallback: (progress: number) => void,
    finish: (result: string) => void,
  ) {
    const emojiValues = Object.values(EMOJIS);
    const emojis: { id: number; color: RGBColor }[] = await Promise.all(
      emojiValues.map(async (value, index) => {
        const path = getEmojiFilePath({ fileType: "png", size: 32, name: value });
        const color = await analyzeEmoji(path);
        progressCallback(((index + 1) / emojiValues.length) * 100);
        return {
          id: index,
          color: color,
        };
      }),
    );

    const tree = new OklabKDTree(emojis);
    const treeBinary = tree.exportBinary();
    var length = treeBinary.buffer.byteLength;
    await localforage.setItem("emojiKdTree", treeBinary);
    finish("Kd-tree training complete. Database size: " + (length / 1024).toFixed(2) + " KB.");
  }

  async loadKdTree() {
    const treeBinary = await localforage.getItem<TreeBinary>("emojiKdTree");
    if (treeBinary) {
      this.tree = OklabKDTree.fromBinary(treeBinary);
    }
  }
}
