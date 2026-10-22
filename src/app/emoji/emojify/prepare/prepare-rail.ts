import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TuiButton, TuiExpand, TuiLabel, TuiSlider, TuiTextfield } from "@taiga-ui/core";
import { TuiAccordion, TuiFiles, TuiInputColor, TuiInputSlider, TuiSwitch } from "@taiga-ui/kit";
import { EmojifyStore } from "../emojify.store";
import { SCALE_OPTIONS } from "../mosaic-renderer";

/** Settings of step 1: tone adjustments, output size and background removal. */
@Component({
  selector: "app-prepare-rail",
  imports: [
    FormsModule,
    TuiAccordion,
    TuiButton,
    TuiExpand,
    TuiFiles,
    TuiInputColor,
    TuiInputSlider,
    TuiLabel,
    TuiSlider,
    TuiSwitch,
    TuiTextfield,
  ],
  template: `
    @if (store.file(); as file) {
      <tui-file class="rail__file" [file]="file" [showDelete]="false" />
    }
    <tui-accordion [closeOthers]="false">
      <button type="button" [tuiAccordion]="true">Adjust</button>
      <tui-expand>
        <div class="rail__group">
          @for (field of adjustmentFields; track field.key) {
            <tui-textfield>
              <label tuiLabel [for]="'adjust-' + field.key">{{ field.label }}</label>
              <input
                tuiInputSlider
                postfix=" %"
                [id]="'adjust-' + field.key"
                [min]="0"
                [max]="200"
                [disabled]="!store.hasImage()"
                [ngModel]="store.prepare().adjustments[field.key]"
                (ngModelChange)="store.setAdjustment(field.key, $event)"
              />
              <input
                tuiSlider
                type="range"
                step="5"
                [attr.aria-label]="field.label"
                [attr.aria-valuetext]="store.prepare().adjustments[field.key] + ' percent'"
              />
            </tui-textfield>
          }
          <button
            tuiButton
            appearance="flat"
            size="s"
            type="button"
            [disabled]="!store.hasImage()"
            (click)="store.resetAdjustments()"
          >
            Reset adjustments
          </button>
        </div>
      </tui-expand>

      <button type="button" [tuiAccordion]="true">Size</button>
      <tui-expand>
        <div class="rail__group">
          <tui-textfield>
            <label tuiLabel for="scale">Scale of the source image</label>
            <input
              id="scale"
              tuiInputSlider
              postfix=" %"
              [min]="minScale"
              [max]="maxScale"
              [disabled]="!store.hasImage()"
              [ngModel]="store.prepare().scale"
              (ngModelChange)="store.setScale($event)"
            />
            <input
              tuiSlider
              type="range"
              [step]="minScale"
              aria-label="Scale"
              [attr.aria-valuetext]="store.prepare().scale + ' percent'"
            />
          </tui-textfield>
          <p class="rail__hint">Larger images give more emoji tiles and a finer mosaic.</p>
          <button
            tuiButton
            appearance="flat"
            size="s"
            type="button"
            [disabled]="!store.hasImage() || store.prepare().scale === 100"
            (click)="store.setScale(100)"
          >
            Reset size
          </button>
        </div>
      </tui-expand>

      <button type="button" [tuiAccordion]="true">Background</button>
      <tui-expand>
        <div class="rail__group">
          <label class="rail__toggle">
            <span>Remove a color</span>
            <input
              tuiSwitch
              type="checkbox"
              [disabled]="!store.hasImage()"
              [ngModel]="store.prepare().removeBackground"
              (ngModelChange)="store.setRemoval({ removeBackground: $event })"
            />
          </label>
          @if (store.prepare().removeBackground) {
            <tui-textfield>
              <label tuiLabel for="remove-color">Color to remove</label>
              <input
                id="remove-color"
                tuiInputColor
                [ngModel]="store.prepare().removeColor"
                (ngModelChange)="setRemoveColor($event)"
              />
            </tui-textfield>
            <tui-textfield>
              <label tuiLabel for="tolerance">Tolerance</label>
              <input
                id="tolerance"
                tuiInputSlider
                postfix=" %"
                [min]="0"
                [max]="100"
                [ngModel]="store.prepare().tolerance"
                (ngModelChange)="store.setRemoval({ tolerance: $event })"
              />
              <input
                tuiSlider
                type="range"
                step="1"
                aria-label="Tolerance"
                [attr.aria-valuetext]="store.prepare().tolerance + ' percent'"
              />
            </tui-textfield>
            <p class="rail__hint">
              Tip: use the pipette above the image to pick the color straight from the picture.
            </p>
          }
          <button
            tuiButton
            appearance="flat"
            size="s"
            type="button"
            [disabled]="!store.hasImage()"
            (click)="store.resetRemoval()"
          >
            Reset background
          </button>
        </div>
      </tui-expand>
    </tui-accordion>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }

    .rail__group {
      display: grid;
      gap: var(--space-3);
      padding-block: var(--space-2);
    }

    .rail__toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
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
export class PrepareRail {
  protected readonly store = inject(EmojifyStore);
  protected readonly minScale = SCALE_OPTIONS[0];
  protected readonly maxScale = SCALE_OPTIONS[SCALE_OPTIONS.length - 1];
  protected readonly adjustmentFields = [
    { key: "brightness", label: "Brightness" },
    { key: "contrast", label: "Contrast" },
    { key: "saturation", label: "Saturation" },
  ] as const;

  protected setRemoveColor(color: string | null) {
    if (color && /^#[0-9a-f]{6}$/i.test(color)) this.store.setRemoval({ removeColor: color });
  }
}
