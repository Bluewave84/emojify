import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Platzhalter für die Bildauswahl (Datei-Dialog und Drag & Drop). Noch ohne Logik. */
@Component({
  selector: 'app-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <label class="cr-drop">
      <input type="file" accept="image/png,image/jpeg,image/webp" />
      <span class="cr-drop__title">Bild auswählen</span>
      <span class="cr-drop__hint">oder hierher ziehen · PNG, JPG oder WebP</span>
    </label>
  `,
})
export class ImagePicker {}
