import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  computed,
  contentChild,
  Directive,
  inject,
  input,
  TemplateRef,
} from "@angular/core";
import { TuiBottomSheet } from "@taiga-ui/addon-mobile";
import { TUI_BREAKPOINT } from "@taiga-ui/core";

/** Marks the settings rail template: `<ng-template appEditorRail>…</ng-template>`. */
@Directive({ selector: "ng-template[appEditorRail]" })
export class EditorRail {
  readonly template = inject(TemplateRef);
}

/**
 * Shared frame of both editor steps: the stage with its action bar in the middle, the
 * settings rail beside it on desktop, or in a bottom sheet on phones. The rail is a
 * template so the same markup can be hosted in either place.
 */
@Component({
  selector: "app-editor-layout",
  imports: [NgTemplateOutlet, TuiBottomSheet],
  host: { class: "editor", "[class.editor--mobile]": "mobile()" },
  template: `
    <section class="editor__stage" [attr.aria-label]="stageLabel()">
      <ng-content select="[editorStage]" />
      <div class="editor__actions">
        <ng-content select="[editorActions]" />
      </div>
    </section>
    @if (mobile()) {
      <div class="editor__sheet">
        <tui-bottom-sheet role="region" [stops]="stops" [attr.aria-label]="railLabel()">
          <ng-container [ngTemplateOutlet]="rail().template" />
        </tui-bottom-sheet>
      </div>
    } @else {
      <aside class="editor__rail" [attr.aria-label]="railLabel()">
        <ng-container [ngTemplateOutlet]="rail().template" />
      </aside>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
      gap: var(--space-5);
      align-items: start;
    }

    .editor__stage {
      display: grid;
      gap: var(--space-4);
      min-inline-size: 0;
    }

    .editor__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .editor__rail {
      position: sticky;
      inset-block-start: var(--space-4);
      max-block-size: calc(100vh - var(--space-8));
      overflow-y: auto;
      padding: var(--space-2) var(--space-4) var(--space-4);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--panel);
      scrollbar-width: thin;
    }

    :host(.editor--mobile) {
      grid-template-columns: minmax(0, 1fr);
      padding-block-end: 5rem;
    }

    .editor__sheet {
      position: fixed;
      inset: 0;
      z-index: 10;
      pointer-events: none;
    }

    .editor__sheet tui-bottom-sheet {
      pointer-events: auto;
    }
  `,
})
export class EditorLayout {
  readonly stageLabel = input.required<string>();
  readonly railLabel = input.required<string>();
  protected readonly rail = contentChild.required(EditorRail);
  private readonly breakpoint = inject(TUI_BREAKPOINT);
  protected readonly mobile = computed(() => this.breakpoint() === "mobile");
  protected readonly stops = ["4rem", "55%"] as const;
}
