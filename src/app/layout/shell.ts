import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { CrButton, ThemeService } from "../ui";

@Component({
  selector: "app-shell",
  imports: [RouterOutlet, RouterLink, CrButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./shell.html",
  styleUrl: "./shell.css",
})
export class Shell {
  protected readonly theme = inject(ThemeService);
}
