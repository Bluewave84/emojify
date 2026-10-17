import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CrButton, CrCard, CrChip } from "../../ui";
import { EmojiSizeSelect } from "../../emoji/emojify/ui/emoji-size-select";
import { ImagePicker } from "../../emoji/emojify/ui/image-picker";
import { ImageStage } from "../../emoji/emojify/ui/image-stage";

/** Seite „Mosaik“: Layout-Anhaltspunkt, noch ohne Logik. */
@Component({
  selector: "app-mosaik",
  imports: [CrButton, CrCard, CrChip, EmojiSizeSelect, ImagePicker, ImageStage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title">Emoji-Mosaik</h1>
    <p class="page-lead">Wähle ein Bild und eine Emoji-Größe, dann entsteht daraus ein Mosaik.</p>

    <div class="layout">
      <aside class="controls" aria-label="Einstellungen">
        <cr-card heading="Bild">
          <span crChip crCardMeta>Kein Bild</span>
          <app-image-picker />
        </cr-card>

        <cr-card heading="Emoji-Größe">
          <span crCardMeta class="cr-card__meta">Raster: –</span>
          <app-emoji-size-select />
          <p class="hint">Kleinere Emojis ergeben mehr Details, größere ein gröberes Raster.</p>
        </cr-card>

        <div class="actions">
          <button crButton variant="primary" type="button" disabled>Mosaik erstellen</button>
          <button crButton variant="ghost" type="button" disabled>Zurücksetzen</button>
        </div>
      </aside>

      <section class="results" aria-label="Vorschau">
        <cr-card heading="Original">
          <app-image-stage placeholder="Noch kein Bild ausgewählt" />
        </cr-card>

        <cr-card heading="Mosaik">
          <span crChip crCardMeta>Leer</span>
          <app-image-stage placeholder="Hier erscheint dein Mosaik" />
          <div class="result-actions">
            <button crButton variant="secondary" type="button" disabled>Herunterladen</button>
          </div>
        </cr-card>
      </section>
    </div>
  `,
  styles: `
    .page-title {
      margin: 0 0 var(--space-1);
      font-size: var(--type-display-size);
      line-height: var(--type-display-line);
      font-weight: var(--type-display-weight);
      letter-spacing: var(--type-display-tracking);
    }

    .page-lead {
      margin: 0 0 var(--space-8);
      color: var(--ink-muted);
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(280px, 360px) 1fr;
      gap: var(--space-6);
      align-items: start;
    }

    .controls,
    .results {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .result-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .hint {
      margin: 0;
      font-size: var(--type-small-size);
      line-height: var(--type-small-line);
      color: var(--ink-muted);
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Mosaik {}
