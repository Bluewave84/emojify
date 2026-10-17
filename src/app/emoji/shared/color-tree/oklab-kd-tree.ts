import type { RGBColor } from "./types";
import { rgbToOklab } from "./utils";

export class OklabKDTree {
  // Flat layout: [L, a, b, id, leftChildIndex, rightChildIndex]
  private treeData!: Float64Array;
  private rootIndex = -1;
  private readonly STRIDE = 6;

  private static readonly L = 0;
  private static readonly A = 1;
  private static readonly B = 2;
  private static readonly ID = 3;
  private static readonly LEFT = 4;
  private static readonly RIGHT = 5;

  constructor(rgbColors: { id: number; color: RGBColor }[]) {
    if (rgbColors.length === 0) return;

    // Convert all source inputs to Oklab space immediately
    const oklabColors = rgbColors.map((c) => ({ id: c.id, ...rgbToOklab(c.color) }));
    this.treeData = new Float64Array(oklabColors.length * this.STRIDE);
    let allocPtr = 0;

    const build = (start: number, end: number, depth: number): number => {
      if (start > end) return -1;

      const axis = depth % 3; // 0=L, 1=a, 2=b

      const sortedRange = oklabColors.slice(start, end + 1).sort((x, y) => {
        if (axis === 0) return x.l - y.l;
        if (axis === 1) return x.a - y.a;
        return x.b - y.b;
      });
      for (let index = 0; index < sortedRange.length; index += 1) {
        oklabColors[start + index] = sortedRange[index];
      }

      const median = (start + end) >> 1;
      const nodePtr = allocPtr;
      allocPtr += this.STRIDE;

      const c = oklabColors[median];
      this.treeData[nodePtr + OklabKDTree.L] = c.l;
      this.treeData[nodePtr + OklabKDTree.A] = c.a;
      this.treeData[nodePtr + OklabKDTree.B] = c.b;
      this.treeData[nodePtr + OklabKDTree.ID] = c.id ?? -1;

      this.treeData[nodePtr + OklabKDTree.LEFT] = build(start, median - 1, depth + 1);
      this.treeData[nodePtr + OklabKDTree.RIGHT] = build(median + 1, end, depth + 1);

      return nodePtr;
    };

    this.rootIndex = build(0, oklabColors.length - 1, 0);
  }

  /**
   * Finds the single perceptually closest color matching the target sRGB input.
   */
  findNearestColor(targetRgb: RGBColor): { id: number; squaredOklabDistance: number } | null {
    if (this.rootIndex === -1) return null;

    // Convert query point to Oklab coordinates
    const target = rgbToOklab(targetRgb);
    let bestNodePtr = -1;
    let bestDistSq = Infinity;

    const search = (nodePtr: number, depth: number) => {
      if (nodePtr === -1) return;

      const axis = depth % 3;
      const nl = this.treeData[nodePtr + OklabKDTree.L];
      const na = this.treeData[nodePtr + OklabKDTree.A];
      const nb = this.treeData[nodePtr + OklabKDTree.B];

      // Standard Euclidean formula works perfectly on Oklab space coordinates
      const dl = target.l - nl;
      const da = target.a - na;
      const db = target.b - nb;
      const distSq = dl * dl + da * da + db * db;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestNodePtr = nodePtr;
      }

      let targetCoord = target.l;
      let nodeCoord = nl;
      if (axis === 1) {
        targetCoord = target.a;
        nodeCoord = na;
      } else if (axis === 2) {
        targetCoord = target.b;
        nodeCoord = nb;
      }

      const axisDiff = targetCoord - nodeCoord;
      const leftPtr = this.treeData[nodePtr + OklabKDTree.LEFT];
      const rightPtr = this.treeData[nodePtr + OklabKDTree.RIGHT];

      const firstChild = axisDiff < 0 ? leftPtr : rightPtr;
      const secondChild = axisDiff < 0 ? rightPtr : leftPtr;

      search(firstChild, depth + 1);

      if (axisDiff * axisDiff < bestDistSq) {
        search(secondChild, depth + 1);
      }
    };

    search(this.rootIndex, 0);

    return {
      id: this.treeData[bestNodePtr + OklabKDTree.ID],
      squaredOklabDistance: bestDistSq,
    };
  }

  exportBinary(): { rootIndex: number; buffer: ArrayBuffer | SharedArrayBuffer } {
    // Wir kopieren den Buffer, um Seiteneffekte zu vermeiden
    return {
      rootIndex: this.rootIndex,
      buffer: this.treeData.buffer.slice(0),
    };
  }

  static fromBinary(exported: {
    rootIndex: number;
    buffer: ArrayBuffer | SharedArrayBuffer;
  }): OklabKDTree {
    const tree = Object.create(OklabKDTree.prototype);
    tree.rootIndex = exported.rootIndex;
    tree.treeData = new Float64Array(exported.buffer);
    return tree;
  }
}
