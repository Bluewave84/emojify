import { Component, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  TuiCheckbox,
  TuiExpand,
  TuiLabel,
  TuiRadio,
  TuiSlider,
  TuiTextfield,
  TuiTitle,
} from "@taiga-ui/core";
import { TuiAccordion, TuiBlock, TuiInputColor, TuiInputSlider, TuiSegmented } from "@taiga-ui/kit";
import { EMOJI_CATEGORIES } from "../../shared/color-tree/emoji-categories";
import { EmojiCategory, EmojiSelectionMode, EmojiVariant } from "../../shared/emoji.service";
import { EmojifyStore, TILE_SIZES } from "../emojify.store";

const BACKGROUND_PRESETS = [
  { value: "transparent", label: "None", color: "#00000000" },
  { value: "white", label: "White", color: "#ffffffff" },
  { value: "black", label: "Black", color: "#000000ff" },
  { value: "custom", label: "Custom", color: "#f4b43aff" },
] as const;

type Preset = (typeof BACKGROUND_PRESETS)[number]["value"];

/** Settings of step 2: tile size, emoji choice and background. */
@Component({
  selector: "app-mosaic-rail",
  imports: [
    FormsModule,
    TuiAccordion,
    TuiBlock,
    TuiCheckbox,
    TuiExpand,
    TuiInputColor,
    TuiInputSlider,
    TuiLabel,
    TuiRadio,
    TuiSegmented,
    TuiSlider,
    TuiTextfield,
    TuiTitle,
  ],
  template: `
    <tui-accordion [closeOthers]="false">
      <button type="button" [tuiAccordion]="true">Tiles</button>
      <tui-expand>
        <div class="rail__group" role="radiogroup" aria-labelledby="tile-label">
          <span id="tile-label" class="rail__label">Emoji size</span>
          <tui-segmented size="s" class="rail__segmented">
            @for (size of tileSizes; track size) {
              <label>
                <input
                  type="radio"
                  name="tile-size"
                  [value]="size"
                  [ngModel]="store.tileSize()"
                  (ngModelChange)="store.setTileSize($event)"
                />
                {{ size }} px
              </label>
            }
          </tui-segmented>
          <p class="rail__hint">Smaller emoji give finer detail, larger ones a bolder look.</p>
        </div>
      </tui-expand>

      <button type="button" [tuiAccordion]="true">Emoji choice</button>
      <tui-expand>
        <div class="rail__group">
          <div role="radiogroup" aria-label="Emoji style">
            <tui-segmented size="s" class="rail__segmented">
              @for (variant of variants; track variant.value) {
                <label>
                  <input
                    type="radio"
                    name="emoji-variant"
                    [value]="variant.value"
                    [ngModel]="store.selection().variant ?? 'color'"
                    (ngModelChange)="setVariant($event)"
                  />
                  {{ variant.label }}
                </label>
              }
            </tui-segmented>
          </div>
          @if (store.selection().variant === "monochrome") {
            <div class="rail__group" role="group" aria-label="Emoji categories">
              @for (category of categories; track category.id) {
                <label class="rail__category">
                  <input
                    tuiCheckbox
                    type="checkbox"
                    [ngModel]="store.selection().categories?.includes(category.id) ?? true"
                    (ngModelChange)="setCategory(category.id, $event)"
                  />
                  {{ category.label }}
                </label>
              }
            </div>
            <p class="rail__hint">Single-color emoji are rendered white. Choose a dark background for contrast.</p>
          } @else {
            <div class="rail__group" role="radiogroup" aria-label="Emoji choice">
              @for (mode of modes; track mode.value) {
                <label tuiBlock="s">
                  <input
                    tuiRadio
                    type="radio"
                    name="emoji-mode"
                    [value]="mode.value"
                    [ngModel]="store.selection().mode"
                    (ngModelChange)="setMode($event)"
                  />
                  <span tuiTitle>
                    {{ mode.label }}
                    <span tuiSubtitle>{{ mode.hint }}</span>
                  </span>
                </label>
              }
              @if (store.selection().mode !== "best") {
                <tui-textfield>
                  <label tuiLabel for="variety">Variety (top N)</label>
                  <input
                    id="variety"
                    tuiInputSlider
                    [min]="2"
                    [max]="20"
                    [ngModel]="store.selection().topN"
                    (ngModelChange)="store.setTopN($event)"
                  />
                  <input
                    tuiSlider
                    type="range"
                    step="1"
                    aria-label="Variety"
                    [attr.aria-valuetext]="store.selection().topN + ' closest emoji'"
                  />
                </tui-textfield>
              }
            </div>
          }
        </div>
      </tui-expand>

      <button type="button" [tuiAccordion]="true">Background</button>
      <tui-expand>
        <div class="rail__group">
          <div class="rail__group" role="radiogroup" aria-labelledby="background-label">
            <span id="background-label" class="rail__label">Background</span>
            <tui-segmented size="s" class="rail__segmented">
              @for (preset of presets; track preset.value) {
                <label>
                  <input
                    type="radio"
                    name="background-preset"
                    [value]="preset.value"
                    [ngModel]="preset$()"
                    (ngModelChange)="setPreset($event)"
                  />
                  {{ preset.label }}
                </label>
              }
            </tui-segmented>
          </div>
          <tui-textfield>
            <label tuiLabel for="background-color">Color and opacity</label>
            <input
              id="background-color"
              tuiInputColor
              format="hexa"
              [ngModel]="store.background()"
              (ngModelChange)="setColor($event)"
            />
          </tui-textfield>
          <p class="rail__hint">An opacity of 0 leaves the background transparent in the PNG.</p>
        </div>
      </tui-expand>
    </tui-accordion>
  `,
  styles: `
    :host {
      display: grid;
    }

    .rail__group {
      display: grid;
      gap: var(--space-3);
      padding-block: var(--space-2);
    }

    .rail__label {
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
      color: var(--ink-muted);
    }

    .rail__segmented {
      inline-size: 100%;
    }

    .rail__category {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-block-size: 36px;
      cursor: pointer;
    }

    .rail__hint {
      margin: 0;
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
      color: var(--ink-muted);
    }
  `,
})
export class MosaicRail {
  protected readonly store = inject(EmojifyStore);
  protected readonly tileSizes = TILE_SIZES;
  protected readonly presets = BACKGROUND_PRESETS;
  protected readonly categories = EMOJI_CATEGORIES;
  protected readonly variants = [
    { value: "color", label: "Color" },
    { value: "monochrome", label: "Single color" },
  ] as const;
  protected readonly modes = [
    { value: "best", label: "Best", hint: "The closest color for every tile" },
    { value: "random", label: "Random", hint: "Mixed from the closest emoji" },
    { value: "roundRobin", label: "Cycle", hint: "Takes turns among the closest emoji" },
  ] as const;

  protected readonly preset$ = computed<Preset>(() => {
    const color = this.store.background().toLowerCase();
    if (color.endsWith("00")) return "transparent";
    return (
      BACKGROUND_PRESETS.find((p) => p.value !== "custom" && p.color === color)?.value ?? "custom"
    );
  });

  protected setMode(mode: EmojiSelectionMode) {
    this.store.setSelectionMode(mode);
  }

  protected setVariant(variant: EmojiVariant) {
    this.store.setEmojiVariant(variant);
  }

  protected setCategory(category: EmojiCategory, selected: boolean) {
    this.store.setEmojiCategory(category, selected);
  }

  protected setPreset(preset: Preset) {
    const match = BACKGROUND_PRESETS.find((p) => p.value === preset);
    if (match) this.store.setBackground(match.color);
  }

  protected setColor(color: string | null) {
    if (color && /^#[0-9a-f]{8}$/i.test(color)) this.store.setBackground(color.toLowerCase());
  }
}
