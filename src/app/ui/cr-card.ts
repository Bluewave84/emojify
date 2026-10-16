import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Nutzung: `<cr-card heading="Deploy · main"><span crCardMeta class="cr-card__meta">pi-hub</span> … Inhalt …</cr-card>`
 * Ein Element mit dem Attribut `crCardMeta` landet rechts im Kopf.
 */
@Component({
  selector: 'cr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <section class="cr-card">
      <div class="cr-card__header">
        <h3 class="cr-card__title">{{ heading() }}</h3>
        <ng-content select="[crCardMeta]" />
      </div>
      <ng-content />
    </section>
  `,
})
export class CrCard {
  readonly heading = input.required<string>();
}
