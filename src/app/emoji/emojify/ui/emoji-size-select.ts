import { FormsModule } from "@angular/forms";
import { Component, model } from "@angular/core";
import { TuiSlider } from "@taiga-ui/core";

@Component({
  selector: "app-emoji-size-select",
  imports: [FormsModule, TuiSlider],
  host: { style: "display: block" },
  template: `
    <div class="size-select">
      <input
        tuiSlider
        type="range"
        min="16"
        max="64"
        step="16"
        [segments]="3"
        [ngModel]="size()"
        (ngModelChange)="size.set($event)"
        aria-label="Emoji size"
        [attr.aria-valuetext]="size() + ' pixels'"
      />
      <div class="size-ticks" aria-hidden="true">
        @for (option of sizes; track option.value) {
          <span [class.size-ticks__active]="option.value === size()">
            <b>{{ option.value }}</b>
            {{ option.label }}
          </span>
        }
      </div>
    </div>
  `,
  styles: `
    .size-select {
      display: grid;
      gap: var(--space-2);
    }

    .size-ticks {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      color: var(--ink-muted);
      font-size: 12px;
      line-height: 16px;
    }

    .size-ticks span {
      display: grid;
    }

    .size-ticks b {
      font-family: var(--font-mono);
      font-weight: 500;
    }

    .size-ticks span:nth-child(2),
    .size-ticks span:nth-child(3) {
      text-align: center;
    }

    .size-ticks span:last-child {
      text-align: end;
    }

    .size-ticks__active {
      color: var(--ink);
    }

    .size-ticks__active b {
      color: var(--accent-text);
    }
  `,
})
export class EmojiSizeSelect {
  readonly size = model<number>(16);
  protected readonly sizes = [
    { value: 16, label: "Fine" },
    { value: 32, label: "Medium" },
    { value: 48, label: "Bold" },
    { value: 64, label: "Chunky" },
  ] as const;
}
