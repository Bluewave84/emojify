import { Component, computed, DOCUMENT, effect, inject, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { TuiButton } from "@taiga-ui/core";
import { TuiFiles, TuiSegmented } from "@taiga-ui/kit";
import { EmojifyStore } from "../emojify.store";
import { renderBackgroundPreview, sampleColor } from "../mosaic-renderer";
import { EditorLayout, EditorRail } from "../ui/editor-layout";
import { ZoomStage } from "../ui/zoom-stage";
import { PrepareRail } from "./prepare-rail";

const PREVIEW_DEBOUNCE_MS = 150;

/** Step 1: load an image and tune it before the mosaic is built. */
@Component({
  selector: "app-prepare-step",
  imports: [
    EditorLayout,
    EditorRail,
    FormsModule,
    PrepareRail,
    TuiButton,
    TuiFiles,
    TuiSegmented,
    ZoomStage,
  ],
  template: `
    <h2 id="step-heading" class="sr-only" tabindex="-1">Step 1 of 2: Prepare your image</h2>
    <app-editor-layout stageLabel="Image" railLabel="Image settings">
      <div editorStage class="slot">
        @if (store.sourceUrl()) {
          <app-zoom-stage [checker]="checker()">
            <tui-segmented stageToolbar size="s" role="radiogroup" aria-label="Show">
              @for (option of views; track option.value) {
                <label>
                  <input
                    type="radio"
                    name="prepare-view"
                    [value]="option.value"
                    [(ngModel)]="view"
                  />
                  {{ option.label }}
                </label>
              }
            </tui-segmented>
            <button
              stageToolbar
              tuiIconButton
              size="s"
              type="button"
              iconStart="@tui.pipette"
              [appearance]="picking() ? 'primary' : 'flat'"
              [attr.aria-pressed]="picking()"
              (click)="picking.set(!picking())"
            >
              Pick the color to remove
            </button>
            <img
              class="preview"
              [class.preview--picking]="picking()"
              [src]="previewSrc()"
              [style.filter]="view() === 'adjusted' ? store.previewFilter() : null"
              [alt]="view() === 'adjusted' ? 'Adjusted image' : 'Original image'"
              [attr.tabindex]="picking() ? 0 : null"
              [attr.aria-label]="
                picking() ? 'Click a pixel, or press Enter to pick the center color' : null
              "
              (click)="pick($event)"
              (keydown.enter)="pickCenter()"
              (keydown.escape)="picking.set(false)"
              draggable="false"
            />
          </app-zoom-stage>
        } @else {
          <label tuiInputFiles class="drop">
            <input
              tuiInputFiles
              accept="image/png,image/jpeg,image/webp"
              [ngModel]="null"
              (ngModelChange)="load($event)"
            />
            <ng-template let-dragged>
              <span class="drop__content">
                <span class="drop__emoji" aria-hidden="true">🖼️ → 😀</span>
                <span class="drop__title">
                  {{ dragged ? "Drop the image here" : "Drop an image here, or click to browse" }}
                </span>
                <span class="drop__hint">PNG, JPG or WebP · up to 20 MB</span>
              </span>
            </ng-template>
          </label>
        }
        @if (store.error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
      </div>

      <ng-container editorActions>
        @if (store.hasImage()) {
          <label tuiButton appearance="secondary" size="m" class="replace">
            <input
              class="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              (change)="replace($event)"
            />
            Replace image
          </label>
        } @else {
          <span></span>
        }
        <button
          tuiButton
          appearance="primary"
          size="m"
          type="button"
          iconEnd="@tui.arrow-right"
          [disabled]="!store.hasImage()"
          (click)="continue()"
        >
          Continue
        </button>
      </ng-container>

      <ng-template appEditorRail>
        <app-prepare-rail />
      </ng-template>
    </app-editor-layout>
  `,
  styles: `
    .slot {
      display: grid;
      gap: var(--space-3);
    }

    .preview {
      display: block;
      max-inline-size: 100%;
      max-block-size: 100%;
      object-fit: contain;
      user-select: none;
    }

    .preview--picking {
      cursor: crosshair;
    }

    .preview:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }

    .drop {
      display: grid;
      place-items: center;
      min-block-size: clamp(320px, 62vh, 640px);
      border-radius: var(--radius-lg);
    }

    .drop__content {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      padding: var(--space-6);
      text-align: center;
    }

    .drop__emoji {
      font-size: 56px;
      line-height: 1.1;
    }

    .drop__title {
      font-size: var(--type-heading-size);
      line-height: var(--type-heading-line);
      font-weight: 600;
    }

    .drop__hint {
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
      color: var(--ink-muted);
    }

    .replace {
      position: relative;
    }

    .replace:focus-within {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }

    .error {
      margin: 0;
      padding: var(--space-3);
      border: 1px solid var(--danger);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--danger) 10%, transparent);
      color: var(--danger);
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
    }
  `,
})
export class PrepareStep {
  protected readonly store = inject(EmojifyStore);
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly stage = viewChild(ZoomStage);

  protected readonly views = [
    { value: "original", label: "Original" },
    { value: "adjusted", label: "Adjusted" },
  ] as const;
  protected readonly view = signal<"original" | "adjusted">("adjusted");
  protected readonly picking = signal(false);
  protected readonly announcement = signal("");
  private readonly cutout = signal<string | null>(null);

  protected readonly checker = computed(
    () => this.view() === "adjusted" && this.store.prepare().removeBackground,
  );
  protected readonly previewSrc = computed(() =>
    this.checker() ? (this.cutout() ?? this.store.sourceUrl()) : this.store.sourceUrl(),
  );

  constructor() {
    effect((onCleanup) => {
      const url = this.store.sourceUrl();
      const { removeBackground, removeColor, tolerance } = this.store.prepare();
      if (!url || !removeBackground) {
        this.cutout.set(null);
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => {
        renderBackgroundPreview(this.doc, url, { color: removeColor, tolerance }, controller.signal)
          .then((preview) => {
            if (!controller.signal.aborted) this.cutout.set(preview);
          })
          .catch(() => undefined);
      }, PREVIEW_DEBOUNCE_MS);
      onCleanup(() => {
        clearTimeout(timer);
        controller.abort();
      });
    });
  }

  protected load(file: File | null) {
    if (file && this.store.load(file)) {
      this.announcement.set(`Loaded ${file.name}.`);
      this.stage()?.resetView();
    }
  }

  protected replace(event: Event) {
    const input = event.target as HTMLInputElement;
    this.load(input.files?.[0] ?? null);
    input.value = "";
  }

  protected async pick(event: MouseEvent) {
    if (!this.picking()) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    await this.sample(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  }

  protected async pickCenter() {
    if (this.picking()) await this.sample(0.5, 0.5);
  }

  private async sample(x: number, y: number) {
    const url = this.store.sourceUrl();
    if (!url) return;
    this.picking.set(false);
    try {
      const color = await sampleColor(this.doc, url, x, y);
      this.store.setRemoval({ removeBackground: true, removeColor: color });
      this.announcement.set(`Picked ${color} as the color to remove.`);
    } catch {
      this.announcement.set("Could not read the color at that point.");
    }
  }

  protected continue() {
    void this.router.navigate(["/result"]);
  }
}
