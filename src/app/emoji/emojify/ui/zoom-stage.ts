import { Component, computed, input, signal } from "@angular/core";
import { TuiPan, TuiZoom, type TuiZoomEvent } from "@taiga-ui/cdk";
import { TuiButton } from "@taiga-ui/core";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const STEP = 1.25;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/**
 * The editor's core: a picture that can be zoomed and panned with wheel, pinch, drag or
 * the toolbar buttons. Toolbar controls are projected with `stageToolbar`.
 */
@Component({
  selector: "app-zoom-stage",
  imports: [TuiButton, TuiPan, TuiZoom],
  host: { class: "stage" },
  template: `
    <div class="stage__toolbar">
      <ng-content select="[stageToolbar]" />
      <span class="stage__spacer"></span>
      <div class="stage__zoom" role="group" aria-label="Zoom">
        <button
          tuiIconButton
          appearance="flat"
          size="s"
          type="button"
          iconStart="@tui.zoom-out"
          [disabled]="zoom() <= minZoom"
          (click)="zoomBy(1 / step)"
        >
          Zoom out
        </button>
        <button
          tuiButton
          appearance="flat"
          size="s"
          type="button"
          class="stage__level"
          [attr.aria-label]="'Reset zoom, currently ' + percent() + ' percent'"
          (click)="resetView()"
        >
          {{ percent() }}%
        </button>
        <button
          tuiIconButton
          appearance="flat"
          size="s"
          type="button"
          iconStart="@tui.zoom-in"
          [disabled]="zoom() >= maxZoom"
          (click)="zoomBy(step)"
        >
          Zoom in
        </button>
      </div>
    </div>
    <div
      class="stage__viewport"
      [class.stage__viewport--checker]="checker()"
      (tuiPan)="pan($event)"
      (tuiZoom)="wheel($event)"
    >
      <div class="stage__content" [style.transform]="transform()">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--panel);
    }

    .stage__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-block-end: 1px solid var(--line);
    }

    .stage__spacer {
      flex: 1;
    }

    .stage__zoom {
      display: flex;
      align-items: center;
    }

    .stage__level {
      min-inline-size: 4rem;
      font-variant-numeric: tabular-nums;
    }

    .stage__viewport {
      display: grid;
      place-items: center;
      block-size: clamp(320px, 62vh, 640px);
      overflow: hidden;
      background: var(--ground);
      cursor: grab;
      touch-action: none;
    }

    .stage__viewport--checker {
      background-color: var(--panel-raised);
      background-image:
        linear-gradient(45deg, var(--line) 25%, transparent 25%, transparent 75%, var(--line) 75%),
        linear-gradient(45deg, var(--line) 25%, transparent 25%, transparent 75%, var(--line) 75%);
      background-position:
        0 0,
        8px 8px;
      background-size: 16px 16px;
    }

    .stage__content {
      display: grid;
      place-items: center;
      inline-size: 100%;
      block-size: 100%;
      transform-origin: center;
    }
  `,
})
export class ZoomStage {
  /** Shows a checkerboard behind transparent pixels. */
  readonly checker = input(false);

  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;
  protected readonly step = STEP;
  protected readonly zoom = signal(1);
  protected readonly offset = signal<readonly [number, number]>([0, 0]);
  protected readonly percent = computed(() => Math.round(this.zoom() * 100));
  protected readonly transform = computed(() => {
    const [x, y] = this.offset();
    return `translate(${x}px, ${y}px) scale(${this.zoom()})`;
  });

  zoomBy(factor: number) {
    this.zoom.update((zoom) => clampZoom(zoom * factor));
  }

  resetView() {
    this.zoom.set(1);
    this.offset.set([0, 0]);
  }

  protected wheel({ delta }: TuiZoomEvent) {
    this.zoomBy(1 + delta);
  }

  protected pan([dx, dy]: readonly [number, number]) {
    this.offset.update(([x, y]) => [x + dx, y + dy]);
  }
}
