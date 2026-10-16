import { ChangeDetectionStrategy, Component, model } from "@angular/core";

@Component({
  selector: "app-emoji-size-select",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: block" },
  template: `
    <fieldset class="cr-seg">
      <legend class="visually-hidden">Emoji-Größe</legend>
      @for (size of sizes; track size.id) {
        <label class="cr-seg__option">
          <input
            type="radio"
            name="emoji-size"
            [value]="size.value"
            [checked]="size.value === this.size()"
            (change)="this.size.set(size.value)"
          />
          <span class="cr-seg__label">{{ size.label }}</span>
          <span class="cr-seg__meta">{{ size.meta }}</span>
        </label>
      }
    </fieldset>
  `,
  styles: `
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class EmojiSizeSelect {
  readonly size = model<number>(16);
  protected readonly sizes = [
    { id: "s", value: 16, label: "Klein", meta: "16 px" },
    { id: "m", value: 32, label: "Mittel", meta: "32 px" },
    { id: "l", value: 48, label: "Groß", meta: "48 px" },
    { id: "xl", value: 64, label: "Sehr groß", meta: "64 px" },
  ] as const;
}
