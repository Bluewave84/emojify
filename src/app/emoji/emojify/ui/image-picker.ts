import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";

/**
 * Drop zone and file picker. `compact` renders a slim button for the settings panel,
 * the default renders the large drop target shown before an image is chosen.
 */
@Component({
  selector: "app-image-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: block" },
  template: `
    <label
      class="picker"
      [class.picker--compact]="compact()"
      [class.picker--over]="dragging()"
      (dragover)="over($event)"
      (dragleave)="dragging.set(false)"
      (drop)="dropFile($event)"
    >
      <input
        class="picker__input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        (change)="imageSelected($event)"
      />
      @if (compact()) {
        <span class="picker__icon" aria-hidden="true">↑</span>
        <span>{{ hasImage() ? "Replace image" : "Choose an image" }}</span>
      } @else {
        <span class="picker__emoji" aria-hidden="true">🖼️ → 😀</span>
        <span class="picker__title">Drop an image here, or click to browse</span>
        <span class="picker__hint">PNG, JPG or WebP · up to 20 MB</span>
      }
    </label>
  `,
  styles: `
    .picker {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      block-size: 100%;
      min-block-size: inherit;
      padding: var(--space-8) var(--space-5);
      border: 2px dashed var(--line-strong);
      border-radius: var(--radius-lg);
      background: var(--panel);
      color: var(--ink);
      text-align: center;
      cursor: pointer;
      transition:
        background 150ms ease-out,
        border-color 150ms ease-out,
        box-shadow 150ms ease-out;
    }

    .picker:hover,
    .picker--over {
      border-color: var(--accent-line);
      background: var(--accent-soft);
    }

    .picker--over {
      box-shadow: var(--shadow-glow);
    }

    .picker:focus-within {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }

    .picker__input {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .picker__emoji {
      font-size: 56px;
      line-height: 1.1;
      letter-spacing: 0.1em;
    }

    .picker__title {
      font-size: var(--type-heading-size);
      line-height: var(--type-heading-line);
      font-weight: 600;
    }

    .picker__hint {
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
      color: var(--ink-muted);
    }

    .picker--compact {
      flex-direction: row;
      min-block-size: 44px;
      padding: 0 var(--space-4);
      border-width: 1px;
      border-style: solid;
      border-radius: var(--radius-sm);
      background: transparent;
      font-weight: 600;
    }

    @media (prefers-reduced-motion: reduce) {
      .picker {
        transition: none;
      }
    }
  `,
})
export class ImagePicker {
  readonly compact = input(false);
  readonly hasImage = input(false);
  readonly fileSelected = output<File>();
  protected readonly dragging = signal(false);

  imageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fileSelected.emit(input.files[0]);
    }
    input.value = "";
  }

  protected over(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  dropFile(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.fileSelected.emit(file);
  }
}
