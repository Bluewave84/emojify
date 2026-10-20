import { ChangeDetectionStrategy, Component, output } from "@angular/core";
import { TuiButton } from "@taiga-ui/core";

@Component({
  selector: "app-image-picker",
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: block" },
  template: `
    <label
      tuiButton
      class="image-picker"
      (dragover)="$event.preventDefault()"
      (drop)="dropFile($event)"
    >
      <input
        class="image-picker__input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        (change)="imageSelected($event)"
      />
      <span>Choose an image or drop a file here</span>
    </label>
  `,
  styles: `
    .image-picker {
      position: relative;
      inline-size: 100%;
      overflow: hidden;
    }

    .image-picker__input {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .image-picker:focus-within {
      outline: 2px solid var(--tui-border-focus);
      outline-offset: 2px;
    }
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
