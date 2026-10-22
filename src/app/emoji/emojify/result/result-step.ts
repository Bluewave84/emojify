import { Component, computed, DestroyRef, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { TuiButton, TuiLoader, TuiNotificationService } from "@taiga-ui/core";
import { TuiButtonLoading, TuiPreview, TuiSegmented } from "@taiga-ui/kit";
import { EmojifyStore } from "../emojify.store";
import { EditorLayout, EditorRail } from "../ui/editor-layout";
import { ZoomStage } from "../ui/zoom-stage";
import { MosaicRail } from "./mosaic-rail";

/** Step 2: the mosaic, regenerated automatically whenever a setting changes. */
@Component({
  selector: "app-result-step",
  imports: [
    EditorLayout,
    EditorRail,
    FormsModule,
    MosaicRail,
    TuiButton,
    TuiButtonLoading,
    TuiLoader,
    TuiPreview,
    TuiSegmented,
    ZoomStage,
  ],
  template: `
    <h2 id="step-heading" class="sr-only" tabindex="-1">Step 2 of 2: Your emoji mosaic</h2>
    <app-editor-layout stageLabel="Mosaic" railLabel="Mosaic settings">
      <div editorStage class="slot" [attr.aria-busy]="store.busy()">
        <app-zoom-stage [checker]="store.transparent() && view() !== 'original'">
          <tui-segmented stageToolbar size="s" role="radiogroup" aria-label="Show">
            @for (option of views; track option.value) {
              <label>
                <input type="radio" name="result-view" [value]="option.value" [(ngModel)]="view" />
                {{ option.label }}
              </label>
            }
          </tui-segmented>
          <button
            stageToolbar
            tuiIconButton
            appearance="flat"
            size="s"
            type="button"
            iconStart="@tui.maximize"
            [disabled]="!store.mosaic()"
            (click)="fullscreen.set(true)"
          >
            Show full screen
          </button>
          <tui-loader class="loader" size="l" [loading]="store.busy()" [overlay]="true">
            <div class="compare" [class.compare--split]="view() === 'split'">
              @if (view() !== "mosaic") {
                <img
                  class="preview"
                  alt="Original image"
                  draggable="false"
                  [src]="store.sourceUrl()"
                  [style.filter]="store.previewFilter()"
                />
              }
              @if (view() !== "original") {
                @if (store.mosaic(); as mosaic) {
                  <img class="preview" alt="Emoji mosaic" draggable="false" [src]="mosaic" />
                } @else if (!store.busy()) {
                  <p class="placeholder">
                    {{ store.dataReady() ? "No mosaic yet." : "Loading emoji color data…" }}
                  </p>
                }
              }
            </div>
          </tui-loader>
        </app-zoom-stage>
        @if (store.error() || store.dataError(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        <p class="sr-only" aria-live="polite">{{ status() }}</p>
      </div>

      <ng-container editorActions>
        <button
          tuiButton
          appearance="secondary"
          size="m"
          type="button"
          iconStart="@tui.arrow-left"
          (click)="back()"
        >
          Back
        </button>
        <button
          tuiButton
          appearance="primary"
          size="m"
          type="button"
          iconStart="@tui.download"
          [loading]="store.busy()"
          [disabled]="!store.mosaic()"
          (click)="store.download()"
        >
          Download PNG
        </button>
      </ng-container>

      <ng-template appEditorRail>
        <app-mosaic-rail />
      </ng-template>
    </app-editor-layout>

    <ng-template [(tuiPreviewDialog)]="fullscreen">
      <tui-preview>
        <tui-preview-title>{{ store.file()?.name }} as emoji</tui-preview-title>
        <button
          tuiIconButton
          tuiPreviewAction
          type="button"
          iconStart="@tui.x"
          (click)="fullscreen.set(false)"
        >
          Close
        </button>
        <img alt="Emoji mosaic, full screen" [src]="store.mosaic()" />
      </tui-preview>
    </ng-template>
  `,
  styles: `
    .slot {
      display: grid;
      gap: var(--space-3);
    }

    .loader {
      inline-size: 100%;
      block-size: 100%;
    }

    .compare {
      display: grid;
      place-items: center;
      inline-size: 100%;
      block-size: 100%;
    }

    .compare--split {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-3);
      padding: var(--space-3);
    }

    .preview {
      display: block;
      max-inline-size: 100%;
      max-block-size: 100%;
      object-fit: contain;
      user-select: none;
    }

    .placeholder {
      margin: 0;
      color: var(--ink-muted);
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
export class ResultStep {
  protected readonly store = inject(EmojifyStore);
  private readonly router = inject(Router);
  private readonly notifications = inject(TuiNotificationService);

  protected readonly views = [
    { value: "mosaic", label: "Mosaic" },
    { value: "original", label: "Original" },
    { value: "split", label: "Split" },
  ] as const;
  protected readonly view = signal<"mosaic" | "original" | "split">("mosaic");
  protected readonly fullscreen = signal(false);
  protected readonly status = computed(() => (this.store.mosaic() ? "Mosaic updated." : ""));

  constructor() {
    this.store.resultActive.set(true);
    inject(DestroyRef).onDestroy(() => this.store.resultActive.set(false));
    effect(() => {
      const message = this.store.error();
      if (message) {
        this.notifications
          .open(message, { appearance: "negative", label: "Mosaic not updated" })
          .subscribe();
      }
    });
  }

  protected back() {
    void this.router.navigate(["/prepare"]);
  }
}
