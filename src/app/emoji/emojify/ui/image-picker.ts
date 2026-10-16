import { ChangeDetectionStrategy, Component, output } from "@angular/core";

@Component({
  selector: "app-image-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: block" },
  template: `
    <label class="cr-drop" (dragover)="$event.preventDefault()" (drop)="dropFile($event)">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        (change)="imageSelected($event)"
      />
      <span class="cr-drop__title">Bild auswählen</span>
      <span class="cr-drop__hint">oder hierher ziehen · PNG, JPG oder WebP</span>
    </label>
  `,
})
export class ImagePicker {
  fileSelected = output<File>();
  imageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.fileSelected.emit(file);
    }
    input.value = "";
  }

  dropFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.fileSelected.emit(file);
  }
}
