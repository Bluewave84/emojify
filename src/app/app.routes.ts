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
        title: "Page not found · Emojify",
        loadComponent: () => import("./pages/not-found/not-found").then((m) => m.NotFound),
      },
    ],
  },
];
