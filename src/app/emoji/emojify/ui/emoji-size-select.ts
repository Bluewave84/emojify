import { FormsModule } from "@angular/forms";
import { ChangeDetectionStrategy, Component, model } from "@angular/core";
import { TuiSlider } from "@taiga-ui/core";

@Component({
  selector: "app-emoji-size-select",
  imports: [FormsModule, TuiSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        aria-label="Emoji-Größe"
      />
      <div class="size-ticks" aria-hidden="true">
        @for (size of sizes; track size) {
          <span>{{ size }} px</span>
        }
      </div>
    </div>
  `,
  styles: `
    .size-select {
      display: grid;
      gap: 0.25rem;
    }

    .size-ticks {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      color: var(--ink-muted);
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
    }

    .size-ticks span:nth-child(2),
    .size-ticks span:nth-child(3) {
      text-align: center;
    }

    .size-ticks span:last-child {
      text-align: end;
    }
  `,
})
export class EmojiSizeSelect {
  readonly size = model<number>(16);
  protected readonly sizes = [16, 32, 48, 64] as const;
}
