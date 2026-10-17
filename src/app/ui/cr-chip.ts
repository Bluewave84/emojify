import { ChangeDetectionStrategy, Component, input } from "@angular/core";

export type CrChipTone = "neutral" | "success" | "danger" | "info" | "accent";

/** Nutzung: `<span crChip tone="success">Passing</span>` */
@Component({
  // Attribute selector so the host keeps native button/span semantics.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "span[crChip]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "<ng-content />",
  host: { "[class]": 'tone() === "neutral" ? "cr-chip" : "cr-chip cr-chip--" + tone()' },
})
export class CrChip {
  readonly tone = input<CrChipTone>("neutral");
}
