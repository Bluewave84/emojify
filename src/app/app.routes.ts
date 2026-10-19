import { Routes } from "@angular/router";
import { Shell } from "./layout/shell";
import { httpResource } from "@angular/common/http";

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
        path: "analysis",
        title: "Analysis · Emojify",
        loadComponent: () => import("./emoji/analysis/image-analysis").then((m) => m.ImageAnalysis),
        resources: () => ({
          dataResource: httpResource.text(() => "/emoji_analysis_32px.csv"),
        }),
      },
      {
        path: "**",
        title: "Nicht gefunden · Emojify",
        loadComponent: () =>
          import("./pages/nicht-gefunden/nicht-gefunden").then((m) => m.NichtGefunden),
      },
    ],
  },
];
