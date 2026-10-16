import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CrButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Nutzung: `<button crButton variant="primary">Erneut ausführen</button>`; für Navigation auch `<a crButton routerLink="…">`. */
@Component({
  selector: 'button[crButton], a[crButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  host: { '[class]': '"cr-btn cr-btn--" + variant()' },
})
export class CrButton {
  readonly variant = input<CrButtonVariant>('secondary');
}
