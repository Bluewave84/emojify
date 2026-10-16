import { EmojiName } from "./emoji-index";

export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  id?: number;
}

export type TreeNodeEmoji = {
  emoji: EmojiName;
  oklab: OklabColor;
};

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

/**
 * Rechnet die Transparenz (Alpha) einer RGBA-Farbe gegen einen
 * rein weißen Hintergrund im linearen Raum heraus.
 */
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

export class OklabKDTree {
  // Flat layout: [L, a, b, id, leftChildIndex, rightChildIndex]

  private treeData!: Float64Array;
  private rootIndex: number = -1;
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

      oklabColors.sort((x, y) => {
        if (axis === 0) return x.l - y.l;
        if (axis === 1) return x.a - y.a;
        return x.b - y.b;
      });

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
  public findNearestColor(
    targetRgb: RGBColor,
  ): { id: number; squaredOklabDistance: number } | null {
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

  public exportBinary(): { rootIndex: number; buffer: ArrayBuffer | SharedArrayBuffer } {
    // Wir kopieren den Buffer, um Seiteneffekte zu vermeiden
    return {
      rootIndex: this.rootIndex,
      buffer: this.treeData.buffer.slice(0),
    };
  }

  /**
   * Erstellt eine voll funktionsfähige Instanz direkt aus einem exportierten Zustand.
   * Benötigt O(1) Zeit (kein Sortieren, kein Baumaufbau).
   */
  public static fromBinary(exported: {
    rootIndex: number;
    buffer: ArrayBuffer | SharedArrayBuffer;
  }): OklabKDTree {
    const tree = Object.create(OklabKDTree.prototype);
    tree.rootIndex = exported.rootIndex;
    tree.treeData = new Float64Array(exported.buffer);
    return tree;
  }
}
