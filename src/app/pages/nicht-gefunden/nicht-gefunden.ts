import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrButton } from '../../ui';

@Component({
  selector: 'app-nicht-gefunden',
  imports: [RouterLink, CrButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="title">Seite nicht gefunden</h1>
    <p class="lead">Diese Adresse gibt es nicht. Prüfe den Link oder geh zurück zur Startseite.</p>
    <a crButton variant="secondary" routerLink="/">Zur Startseite</a>
  `,
  styles: `
    .title {
      margin: 0 0 var(--space-2);
      font-size: var(--type-title-size);
      line-height: var(--type-title-line);
      font-weight: var(--type-title-weight);
    }
    .lead {
      margin: 0 0 var(--space-6);
      color: var(--ink-muted);
    }
  `,
})
export class NichtGefunden {}
