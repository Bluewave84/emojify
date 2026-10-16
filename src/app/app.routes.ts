import { Routes } from "@angular/router";
import { Shell } from "./layout/shell";

export const routes: Routes = [
  {
    path: "",
    component: Shell,
    children: [
      {
        path: "",
        pathMatch: "full",
        title: "Emoji-Mosaik · Control Room",
        loadComponent: () => import("./pages/mosaik/mosaik").then((m) => m.Mosaik),
      },
      {
        path: "setup",
        title: "Setup and Analysis · Control Room",
        loadComponent: () => import("./emoji/analyze/emoji-setup").then((m) => m.EmojiSetup),
      },
      {
        path: "**",
        title: "Nicht gefunden · Control Room",
        loadComponent: () =>
          import("./pages/nicht-gefunden/nicht-gefunden").then((m) => m.NichtGefunden),
      },
    ],
  },
];
