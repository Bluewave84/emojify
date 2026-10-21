import { HttpClient } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from "@angular/core";
import { TuiButton, TuiCheckbox, TuiExpand, TuiRadio, TuiSlider } from "@taiga-ui/core";
import { TuiAccordion } from "@taiga-ui/kit";
import { firstValueFrom, fromEvent, takeUntil } from "rxjs";
import { CrCard } from "../../ui";
import { EmojiSizeSelect } from "./ui/emoji-size-select";
import { ImagePicker } from "./ui/image-picker";
import { ImageStage } from "./ui/image-stage";
import {
  DEFAULT_SELECTION,
  EmojiSelection,
  EmojiSelectionMode,
  EmojiService,
} from "../shared/emoji.service";
import {
  analyzeImageParts,
  createEmojiImage,
  DEFAULT_ADJUSTMENTS,
  ImageAdjustments,
  SCALE_OPTIONS,
} from "./mosaic-renderer";

@Component({
  selector: "app-emojify",
  imports: [
    FormsModule,
    TuiAccordion,
    TuiButton,
    TuiCheckbox,
    TuiExpand,
    TuiRadio,
    TuiSlider,
    CrCard,
    EmojiSizeSelect,
    ImagePicker,
    ImageStage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./emojify.page.html",
  styleUrl: "./emojify.page.css",
})
export class Emojify {
  private readonly emojiService = inject(EmojiService);
  private readonly doc = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private operation = 0;
  private controller?: AbortController;

  readonly selectedFile = signal<File | null>(null);
  readonly emojiSize = signal(16);
  readonly transparentBackground = signal(false);
  readonly backgroundColor = signal("#000000");
  readonly scaleOptions = SCALE_OPTIONS;
  readonly scale = signal(100);
  readonly removeBackground = signal(false);
  readonly removeColor = signal("#ffffff");
  readonly tolerance = signal(10);
  readonly adjustments = signal<ImageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  readonly previewFilter = computed(() => {
    const a = this.adjustments();
    return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
  });
  readonly adjustmentFields = [
    { key: "brightness", label: "Brightness" },
    { key: "contrast", label: "Contrast" },
    { key: "saturation", label: "Saturation" },
  ] as const;
  readonly selection = signal<EmojiSelection>({ ...DEFAULT_SELECTION });
  readonly selectionModes = [
    { value: "best", label: "Best", meta: "Top 1" },
    { value: "random", label: "Random", meta: "Top N" },
    { value: "roundRobin", label: "Round robin", meta: "Top N" },
  ] as const;
  readonly imageSource = signal<string | null>(null);
  readonly mosaicSource = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly dataError = this.emojiService.error;
  readonly dataReady = this.emojiService.ready;
  readonly canCreate = computed(() => !!this.imageSource() && this.dataReady() && !this.busy());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  selectFile(file: File) {
    this.reset();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      this.error.set("Please select a PNG, JPG, or WebP file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.error.set("The file must not exceed 20 MB.");
      return;
    }
    this.selectedFile.set(file);
    this.imageSource.set(URL.createObjectURL(file));
  }

  changeSize(size: number) {
    this.operation++;
    this.controller?.abort();
    this.emojiSize.set(size);
    this.mosaicSource.set(null);
    this.busy.set(false);
    this.error.set(null);
  }

  changeAdjustment(key: keyof ImageAdjustments, value: number) {
    this.operation++;
    this.controller?.abort();
    this.adjustments.update((a) => ({ ...a, [key]: value }));
    this.mosaicSource.set(null);
    this.busy.set(false);
    this.error.set(null);
  }

  changeSelectionMode(mode: EmojiSelectionMode) {
    this.invalidateMosaic();
    this.selection.update((s) => ({ ...s, mode }));
  }

  changeTopN(topN: number) {
    this.invalidateMosaic();
    this.selection.update((s) => ({ ...s, topN }));
  }

  changeTransparentBackground(transparent: boolean) {
    this.invalidateMosaic();
    this.transparentBackground.set(transparent);
  }

  changeBackgroundColor(event: Event) {
    this.invalidateMosaic();
    this.backgroundColor.set((event.target as HTMLInputElement).value);
  }

  changeScale(scale: number) {
    this.invalidateMosaic();
    this.scale.set(Number(scale));
  }

  changeRemoveBackground(remove: boolean) {
    this.invalidateMosaic();
    this.removeBackground.set(remove);
  }

  changeRemoveColor(event: Event) {
    this.invalidateMosaic();
    this.removeColor.set((event.target as HTMLInputElement).value);
  }

  changeTolerance(tolerance: number) {
    this.invalidateMosaic();
    this.tolerance.set(Number(tolerance));
  }

  private invalidateMosaic() {
    this.operation++;
    this.controller?.abort();
    this.mosaicSource.set(null);
    this.busy.set(false);
    this.error.set(null);
  }

  resetAdjustments() {
    this.operation++;
    this.controller?.abort();
    this.adjustments.set({ ...DEFAULT_ADJUSTMENTS });
    this.mosaicSource.set(null);
    this.busy.set(false);
    this.error.set(null);
  }

  async create() {
    const source = this.imageSource();
    if (!source || !this.canCreate()) return;
    const operation = ++this.operation;
    const controller = new AbortController();
    this.controller = controller;
    const size = this.emojiSize();
    this.busy.set(true);
    this.error.set(null);
    this.mosaicSource.set(null);

    try {
      const [parts, sprite] = await Promise.all([
        analyzeImageParts(this.doc, source, size, controller.signal, {
          adjustments: this.adjustments(),
          scale: this.scale(),
          removeBackground: this.removeBackground()
            ? { color: this.removeColor(), tolerance: this.tolerance() }
            : null,
        }),
        firstValueFrom(
          this.http
            .get("/emoji-sprite.svg", { responseType: "text" })
            .pipe(takeUntil(fromEvent(controller.signal, "abort"))),
        ),
      ]);
      if (operation !== this.operation) return;
      const visible = parts.filter((part) => part.color[3] > 0);
      if (visible.length === 0) {
        this.error.set("Nothing left to render: the background removal covers the whole image.");
        return;
      }
      const grid = parts.reduce(
        (g, part) => ({
          rows: Math.max(g.rows, part.row + 1),
          cols: Math.max(g.cols, part.col + 1),
        }),
        { rows: 0, cols: 0 },
      );
      const result = await createEmojiImage(
        this.doc,
        this.emojiService.emojify(visible, this.selection()),
        size,
        sprite,
        controller.signal,
        this.transparentBackground() ? null : this.backgroundColor(),
        grid,
      );
      if (operation === this.operation) this.mosaicSource.set(result);
    } catch {
      if (operation === this.operation) {
        this.error.set(
          "Could not create the mosaic. Please select a valid image up to 16 megapixels and try again.",
        );
      }
    } finally {
      controller.abort();
      if (operation === this.operation) this.busy.set(false);
    }
  }

  download() {
    const source = this.mosaicSource();
    if (!source) return;
    const link = this.doc.createElement("a");
    link.href = source;
    link.download = `${this.selectedFile()?.name.replace(/\.[^.]+$/, "") || "image"}-emoji.png`;
    link.click();
  }

  reset() {
    this.operation++;
    this.controller?.abort();
    const source = this.imageSource();
    if (source) URL.revokeObjectURL(source);
    this.selectedFile.set(null);
    this.scale.set(100);
    this.removeBackground.set(false);
    this.adjustments.set({ ...DEFAULT_ADJUSTMENTS });
    this.imageSource.set(null);
    this.mosaicSource.set(null);
    this.busy.set(false);
    this.error.set(null);
  }
}
