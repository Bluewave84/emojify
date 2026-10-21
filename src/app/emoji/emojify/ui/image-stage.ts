import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** Placeholder surface for the original image or the finished mosaic. */
@Component({
  selector: "app-image-stage",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: block; width: 100%" },
  template: `<div class="stage" role="img" [attr.aria-label]="placeholder()">
    {{ placeholder() }}
  </div>`,
  styles: `
    .stage {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      padding: var(--space-5);
      color: var(--ink-muted);
      text-align: center;
      text-wrap: balance;
    }
  `,
})
export class ImageStage {
  readonly placeholder = input.required<string>();
}
