import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Platzhalter für die Größenwahl der Emojis. Nutzt native Radio-Buttons, noch ohne Anbindung. */
@Component({
  selector: 'app-emoji-size-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <fieldset class="cr-seg">
      <legend class="visually-hidden">Emoji-Größe</legend>
      @for (size of sizes; track size.id) {
        <label class="cr-seg__option">
          <input type="radio" name="emoji-size" [value]="size.id" [checked]="size.id === 'm'" />
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
  // Platzhalter-Optionen; die echten Größen legt die spätere Logik fest.
  protected readonly sizes = [
    { id: 's', label: 'Klein', meta: '16 px' },
    { id: 'm', label: 'Mittel', meta: '32 px' },
    { id: 'l', label: 'Groß', meta: '48 px' },
    { id: 'xl', label: 'Sehr groß', meta: '64 px' },
  ] as const;
}
