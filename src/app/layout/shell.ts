import { Component, inject } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { ThemeService } from "../ui";
import { TuiButton } from "@taiga-ui/core/components/button";
import { TuiIcon } from "@taiga-ui/core/components/icon";

@Component({
  selector: "app-shell",
  imports: [RouterOutlet, RouterLink, TuiIcon, TuiButton],
  templateUrl: "./shell.html",
  styleUrl: "./shell.css",
})
export class Shell {
  protected readonly theme = inject(ThemeService);
}
