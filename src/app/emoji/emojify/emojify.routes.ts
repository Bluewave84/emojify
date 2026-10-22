import { inject } from "@angular/core";
import { CanActivateFn, Router, Routes } from "@angular/router";
import { EmojifyShell } from "./emojify-shell";
import { EmojifyStore } from "./emojify.store";

/** The result step needs an image; without one, send the user back to step 1. */
export const requireImage: CanActivateFn = () =>
  inject(EmojifyStore).hasImage() || inject(Router).createUrlTree(["/prepare"]);

export const EMOJIFY_ROUTES: Routes = [
  {
    path: "",
    component: EmojifyShell,
    children: [
      { path: "", pathMatch: "full", redirectTo: "prepare" },
      {
        path: "prepare",
        title: "Prepare your image · Emojify",
        loadComponent: () => import("./prepare/prepare-step").then((m) => m.PrepareStep),
      },
      {
        path: "result",
        title: "Your emoji mosaic · Emojify",
        canActivate: [requireImage],
        loadComponent: () => import("./result/result-step").then((m) => m.ResultStep),
      },
    ],
  },
];
