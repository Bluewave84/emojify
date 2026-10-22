import { HttpClient } from "@angular/common/http";
import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  InjectionToken,
  Service,
  signal,
  untracked,
} from "@angular/core";
import { firstValueFrom, fromEvent, takeUntil } from "rxjs";
import {
  DEFAULT_SELECTION,
  EmojiPart,
  EmojiSelection,
  EmojiSelectionMode,
  EmojiVariant,
  EmojiService,
} from "../shared/emoji.service";
import { EmojiCategory } from "../shared/color-tree/emoji-categories";
import {
  analyzeImageParts,
  backgroundAlpha,
  backgroundFill,
  createEmojiImage,
  DEFAULT_ADJUSTMENTS,
  ImageAdjustments,
} from "./mosaic-renderer";

export interface PrepareSettings {
  adjustments: ImageAdjustments;
  /** Percent, 100 = original size. */
  scale: number;
  removeBackground: boolean;
  removeColor: string;
  /** Percent (0-100). */
  tolerance: number;
}

export const DEFAULT_PREPARE: PrepareSettings = {
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  scale: 100,
  removeBackground: false,
  removeColor: "#ffffff",
  tolerance: 10,
};

export const TILE_SIZES = [16, 32, 48, 64] as const;
export const DEFAULT_TILE_SIZE = 16;
/** `#rrggbbaa`; alpha 00 renders a transparent background. */
export const DEFAULT_BACKGROUND = "#000000ff";
export const RENDER_DEBOUNCE_MS = 300;

/** The canvas stages of the pipeline; replaced with fakes in tests. */
export const MOSAIC_PIPELINE = new InjectionToken("MOSAIC_PIPELINE", {
  factory: () => ({ analyzeImageParts, createEmojiImage }),
});

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface RenderRequest {
  url: string;
  prepare: PrepareSettings;
  tileSize: number;
  selection: EmojiSelection;
  background: string;
}

interface Analysis {
  key: string;
  visible: Parameters<EmojiService["emojify"]>[0];
  grid: { rows: number; cols: number };
}

/**
 * State of the two-step editor and the mosaic pipeline. Step 2 renders automatically:
 * every change is debounced, a newer render aborts the running one, and the image
 * analysis and emoji mapping are cached so later stages re-run on their own.
 */
@Service()
export class EmojifyStore {
  private readonly doc = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly emojiService = inject(EmojiService);
  private readonly pipeline = inject(MOSAIC_PIPELINE);

  private readonly source = signal<{ file: File; url: string } | null>(null);
  readonly file = computed(() => this.source()?.file ?? null);
  readonly sourceUrl = computed(() => this.source()?.url ?? null);
  readonly hasImage = computed(() => !!this.source());

  readonly prepare = signal<PrepareSettings>(clonePrepare(DEFAULT_PREPARE));
  readonly tileSize = signal<number>(DEFAULT_TILE_SIZE);
  readonly selection = signal<EmojiSelection>({ ...DEFAULT_SELECTION });
  readonly background = signal(DEFAULT_BACKGROUND);

  /** Set while the result step is shown; the mosaic only renders then. */
  readonly resultActive = signal(false);

  readonly mosaic = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly dataReady = this.emojiService.ready;
  readonly dataError = this.emojiService.error;

  readonly previewFilter = computed(() => {
    const { brightness, contrast, saturation } = this.prepare().adjustments;
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  });
  readonly transparent = computed(() => backgroundAlpha(this.background()) < 255);

  private readonly request = computed<RenderRequest | null>(() => {
    const url = this.sourceUrl();
    if (!url || !this.resultActive() || !this.dataReady()) return null;
    return {
      url,
      prepare: this.prepare(),
      tileSize: this.tileSize(),
      selection: this.selection(),
      background: this.background(),
    };
  });

  private operation = 0;
  private controller?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private sprite: string | null = null;
  private analysis: Analysis | null = null;
  private mapping: { key: string; parts: EmojiPart[] } | null = null;

  constructor() {
    effect(() => {
      const request = this.request();
      untracked(() => this.schedule(request));
    });
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  /** Validates and loads a new image. Returns false and sets an error when it is rejected. */
  load(file: File): boolean {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.error.set("Please select a PNG, JPG, or WebP file.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.error.set("The file must not exceed 20 MB.");
      return false;
    }
    this.reset();
    this.source.set({ file, url: URL.createObjectURL(file) });
    return true;
  }

  reset() {
    this.cancel();
    const url = this.sourceUrl();
    if (url) URL.revokeObjectURL(url);
    this.source.set(null);
    this.prepare.set(clonePrepare(DEFAULT_PREPARE));
    this.analysis = null;
    this.mapping = null;
    this.mosaic.set(null);
    this.error.set(null);
  }

  setAdjustment(key: keyof ImageAdjustments, value: number) {
    this.prepare.update((p) => ({ ...p, adjustments: { ...p.adjustments, [key]: value } }));
  }

  resetAdjustments() {
    this.prepare.update((p) => ({ ...p, adjustments: { ...DEFAULT_ADJUSTMENTS } }));
  }

  setScale(scale: number) {
    this.prepare.update((p) => ({ ...p, scale }));
  }

  setRemoval(
    patch: Partial<Pick<PrepareSettings, "removeBackground" | "removeColor" | "tolerance">>,
  ) {
    this.prepare.update((p) => ({ ...p, ...patch }));
  }

  resetRemoval() {
    const { removeBackground, removeColor, tolerance } = DEFAULT_PREPARE;
    this.setRemoval({ removeBackground, removeColor, tolerance });
  }

  setTileSize(size: number) {
    this.tileSize.set(size);
  }

  setSelectionMode(mode: EmojiSelectionMode) {
    this.selection.update((s) => ({ ...s, mode }));
  }

  setEmojiVariant(variant: EmojiVariant) {
    this.selection.update((s) => ({ ...s, variant }));
  }

  setEmojiCategory(category: EmojiCategory, selected: boolean) {
    this.selection.update((selection) => {
      const categories = selection.categories ?? DEFAULT_SELECTION.categories!;
      const next = selected
        ? [...new Set([...categories, category])]
        : categories.filter((item) => item !== category);
      return { ...selection, categories: next.length ? next : categories };
    });
  }

  setTopN(topN: number) {
    this.selection.update((s) => ({ ...s, topN }));
  }

  setBackground(hexa: string) {
    this.background.set(hexa);
  }

  download() {
    const source = this.mosaic();
    if (!source) return;
    const link = this.doc.createElement("a");
    link.href = source;
    link.download = `${this.file()?.name.replace(/\.[^.]+$/, "") || "image"}-emoji.png`;
    link.click();
  }

  private cancel() {
    this.operation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.controller?.abort();
    this.controller = undefined;
    this.busy.set(false);
  }

  private schedule(request: RenderRequest | null) {
    this.cancel();
    if (!request) return;
    const operation = this.operation;
    this.busy.set(true);
    this.error.set(null);
    this.timer = setTimeout(() => void this.render(request, operation), RENDER_DEBOUNCE_MS);
  }

  private async render(request: RenderRequest, operation: number) {
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    try {
      const analysis = await this.analyze(request, signal);
      if (operation !== this.operation) return;
      if (analysis.visible.length === 0) {
        this.mosaic.set(null);
        this.error.set("Nothing left to render: the background removal covers the whole image.");
        return;
      }
      const mappingKey = `${analysis.key}|${JSON.stringify(request.selection)}`;
      if (this.mapping?.key !== mappingKey) {
        this.mapping = {
          key: mappingKey,
          parts: this.emojiService.emojify(analysis.visible, request.selection),
        };
      }
      const sprite = await this.loadSprite(signal);
      const result = await this.pipeline.createEmojiImage(
        this.doc,
        this.mapping.parts,
        request.tileSize,
        sprite,
        signal,
        backgroundFill(request.background),
        analysis.grid,
        request.selection.variant === "monochrome",
      );
      if (operation === this.operation) this.mosaic.set(result);
    } catch {
      if (operation === this.operation && !signal.aborted) {
        this.error.set(
          "Could not create the mosaic. Please select a valid image up to 16 megapixels and try again.",
        );
      }
    } finally {
      if (operation === this.operation) {
        this.busy.set(false);
        this.controller = undefined;
      }
    }
  }

  private async analyze(request: RenderRequest, signal: AbortSignal): Promise<Analysis> {
    const { url, prepare, tileSize } = request;
    const key = JSON.stringify([url, prepare, tileSize]);
    if (this.analysis?.key === key) return this.analysis;
    const parts = await this.pipeline.analyzeImageParts(this.doc, url, tileSize, signal, {
      adjustments: prepare.adjustments,
      scale: prepare.scale,
      removeBackground: prepare.removeBackground
        ? { color: prepare.removeColor, tolerance: prepare.tolerance }
        : null,
    });
    const grid = parts.reduce(
      (g, part) => ({ rows: Math.max(g.rows, part.row + 1), cols: Math.max(g.cols, part.col + 1) }),
      { rows: 0, cols: 0 },
    );
    const visible = parts.filter((part) => part.color[3] > 0);
    this.analysis = { key, visible, grid };
    this.mapping = null;
    return this.analysis;
  }

  private async loadSprite(signal: AbortSignal): Promise<string> {
    if (this.sprite !== null) return this.sprite;
    this.sprite = await firstValueFrom(
      this.http
        .get("emoji-sprite.svg", { responseType: "text" })
        .pipe(takeUntil(fromEvent(signal, "abort"))),
    );
    return this.sprite;
  }
}

function clonePrepare(prepare: PrepareSettings): PrepareSettings {
  return { ...prepare, adjustments: { ...prepare.adjustments } };
}
