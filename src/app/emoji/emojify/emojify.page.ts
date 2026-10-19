import { HttpClient } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom, fromEvent, takeUntil } from "rxjs";
import { CrButton, CrCard, CrChip } from "../../ui";
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
} from "./mosaic-renderer";

@Component({
  selector: "app-emojify",
  imports: [CrButton, CrCard, CrChip, EmojiSizeSelect, ImagePicker, ImageStage],
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
  readonly adjustments = signal<ImageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  readonly previewFilter = computed(() => {
    const a = this.adjustments();
    return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
  });
  readonly adjustmentFields = [
    { key: "brightness", label: "Helligkeit" },
    { key: "contrast", label: "Kontrast" },
    { key: "saturation", label: "Sättigung" },
  ] as const;
  readonly selection = signal<EmojiSelection>({ ...DEFAULT_SELECTION });
  readonly selectionModes = [
    { value: "best", label: "Beste", meta: "Top 1" },
    { value: "random", label: "Zufall", meta: "Top N" },
    { value: "roundRobin", label: "Reihum", meta: "Top N" },
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
      this.error.set("Bitte eine PNG-, JPG- oder WebP-Datei auswählen.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.error.set("Die Datei darf maximal 20 MB groß sein.");
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

  changeAdjustment(key: keyof ImageAdjustments, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
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

  changeTopN(event: Event) {
    const topN = Number((event.target as HTMLInputElement).value);
    this.invalidateMosaic();
    this.selection.update((s) => ({ ...s, topN }));
  }

  changeTransparentBackground(event: Event) {
    this.invalidateMosaic();
    this.transparentBackground.set((event.target as HTMLInputElement).checked);
  }

  changeBackgroundColor(event: Event) {
    this.invalidateMosaic();
    this.backgroundColor.set((event.target as HTMLInputElement).value);
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
        analyzeImageParts(this.doc, source, size, controller.signal, this.adjustments()),
        firstValueFrom(
          this.http
            .get("/emoji-sprite.svg", { responseType: "text" })
            .pipe(takeUntil(fromEvent(controller.signal, "abort"))),
        ),
      ]);
      if (operation !== this.operation) return;
      const result = await createEmojiImage(
        this.doc,
        this.emojiService.emojify(parts, this.selection()),
        size,
        sprite,
        controller.signal,
        this.transparentBackground() ? null : this.backgroundColor(),
      );
      if (operation === this.operation) this.mosaicSource.set(result);
    } catch {
      if (operation === this.operation) {
        this.error.set(
          "Mosaik konnte nicht erstellt werden. Bitte ein gültiges Bild bis 16 Megapixel auswählen und erneut versuchen.",
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
    link.download = `${this.selectedFile()?.name.replace(/\.[^.]+$/, "") || "bild"}-emoji.png`;
    link.click();
  }

  reset() {
    this.operation++;
    this.controller?.abort();
    const source = this.imageSource();
    if (source) URL.revokeObjectURL(source);
    this.selectedFile.set(null);
    this.adjustments.set({ ...DEFAULT_ADJUSTMENTS });
    this.imageSource.set(null);
    this.mosaicSource.set(null);
    this.busy.set(false);
    this.error.set(null);
  }
}
