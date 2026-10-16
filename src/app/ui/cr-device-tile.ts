import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/** Nutzung: `<cr-device-tile label="Wohnzimmer Licht" [(on)]="lichtAn" metaOn="an · 2700 K · 80 %" metaOff="aus" />` */
@Component({
  selector: 'cr-device-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <button
      type="button"
      class="cr-tile"
      [attr.aria-pressed]="on() ? 'true' : 'false'"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <span class="cr-tile__text">
        <span class="cr-tile__label">{{ label() }}</span>
        <span class="cr-tile__meta">{{ meta() }}</span>
      </span>
      <span class="cr-track"><span class="cr-knob"></span></span>
    </button>
  `,
})
export class CrDeviceTile {
  readonly label = input.required<string>();
  readonly on = model(false);
  readonly metaOn = input('an');
  readonly metaOff = input('aus');
  readonly disabled = input(false);

  protected readonly meta = computed(() => (this.on() ? this.metaOn() : this.metaOff()));

  protected toggle(): void {
    this.on.update((value) => !value);
  }
}
