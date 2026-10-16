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
        title: "Convert your image · Emojify",
        loadComponent: () => import("./emoji/emojify/emojify.page").then((m) => m.Emojify),
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
