import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface CrLogLine {
  time: string;
  text: string;
  level?: 'ok' | 'err' | 'hl';
}

/** Nutzung: `<cr-log-panel [lines]="zeilen()" />`. Der Text nennt den Zustand als Wort („error", „ok"). */
@Component({
  selector: 'cr-log-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <div class="cr-log" role="log" aria-live="polite">
      @for (line of lines(); track $index) {
        <div class="cr-log__line">
          <span class="cr-log__time">{{ line.time }}</span>
          <span
            [class.cr-log__ok]="line.level === 'ok'"
            [class.cr-log__err]="line.level === 'err'"
            [class.cr-log__hl]="line.level === 'hl'"
            >{{ line.text }}</span
          >
        </div>
      }
    </div>
  `,
})
export class CrLogPanel {
  readonly lines = input.required<readonly CrLogLine[]>();
}
