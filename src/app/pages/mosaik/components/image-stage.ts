import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Anzeigefläche für das Originalbild bzw. das fertige Mosaik. Zeigt vorerst nur einen Platzhaltertext. */
@Component({
  selector: 'app-image-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `<div class="cr-stage" role="img" [attr.aria-label]="placeholder()">{{ placeholder() }}</div>`,
})
export class ImageStage {
  readonly placeholder = input.required<string>();
}
