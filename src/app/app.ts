import { TuiRoot } from "@taiga-ui/core";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ThemeService } from "./ui";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, TuiRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-root>
      <router-outlet />
    </tui-root>
  `,
})
export class App {
  private readonly theme = inject(ThemeService);
}
