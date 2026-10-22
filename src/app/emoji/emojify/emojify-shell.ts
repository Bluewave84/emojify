import { afterNextRender, Component, DestroyRef, DOCUMENT, inject, Injector } from "@angular/core";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { TuiStepper } from "@taiga-ui/kit";
import { filter, skip } from "rxjs";
import { EmojifyStore } from "./emojify.store";

/** Frame of the two-step editor: intro, stepper and the active step. */
@Component({
  selector: "app-emojify-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TuiStepper],
  template: `
    <header class="intro">
      <p class="intro__eyebrow">Image → Emoji</p>
      <h1 class="intro__title">Turn any picture into an emoji mosaic</h1>
    </header>
    <nav class="steps" aria-label="Steps">
      <tui-stepper>
        <a
          tuiStep
          routerLink="prepare"
          routerLinkActive="steps__active"
          ariaCurrentWhenActive="step"
          [stepState]="store.hasImage() ? 'pass' : 'normal'"
        >
          Prepare image
        </a>
        @if (store.hasImage()) {
          <a
            tuiStep
            routerLink="result"
            routerLinkActive="steps__active"
            ariaCurrentWhenActive="step"
          >
            Create mosaic
          </a>
        } @else {
          <button tuiStep type="button" disabled>Create mosaic</button>
        }
      </tui-stepper>
    </nav>
    <router-outlet />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }

    .intro {
      display: grid;
      gap: var(--space-1);
    }

    .intro__eyebrow {
      margin: 0;
      font-family: var(--type-label-family);
      font-size: var(--type-label-size);
      line-height: var(--type-label-line);
      font-weight: var(--type-label-weight);
      letter-spacing: var(--type-label-tracking);
      text-transform: uppercase;
      color: var(--accent-text);
    }

    .intro__title {
      margin: 0;
      font-size: clamp(24px, 3.4vw, var(--type-display-size));
      line-height: 1.15;
      font-weight: var(--type-display-weight);
      letter-spacing: var(--type-display-tracking);
      text-wrap: balance;
    }

    .steps {
      overflow-x: auto;
    }
  `,
})
export class EmojifyShell {
  protected readonly store = inject(EmojifyStore);

  constructor() {
    const doc = inject(DOCUMENT);
    const injector = inject(Injector);
    const subscription = inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
      )
      .subscribe(() =>
        afterNextRender(() => doc.getElementById("step-heading")?.focus(), { injector }),
      );
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }
}
