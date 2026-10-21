import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { CrButton } from "../../ui";

@Component({
  selector: "app-not-found",
  imports: [RouterLink, CrButton],
  template: `
    <div class="wrap">
      <span class="emoji" aria-hidden="true">🤷</span>
      <h1 class="title">Page not found</h1>
      <p class="lead">That address doesn't exist. Check the link or head back to the start.</p>
      <a crButton variant="primary" routerLink="/">Back to Emojify</a>
    </div>
  `,
  styles: `
    .wrap {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
      padding: var(--space-10) 0;
      text-align: center;
    }
    .emoji {
      font-size: 64px;
      line-height: 1;
    }
    .title {
      margin: 0;
      font-size: var(--type-title-size);
      line-height: var(--type-title-line);
      font-weight: var(--type-title-weight);
    }
    .lead {
      margin: 0 0 var(--space-3);
      color: var(--ink-muted);
    }
  `,
})
export class NotFound {}
