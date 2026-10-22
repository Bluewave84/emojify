import { Routes } from "@angular/router";
import { Shell } from "./layout/shell";
export const routes: Routes = [
  {
    path: "",
    component: Shell,
    children: [
      {
        path: "",
        loadChildren: () => import("./emoji/emojify/emojify.routes").then((m) => m.EMOJIFY_ROUTES),
      },
      {
        path: "**",
        title: "Page not found · Emojify",
        loadComponent: () => import("./pages/not-found/not-found").then((m) => m.NotFound),
      },
    ],
  },
];
