import { provideTaiga } from "@taiga-ui/core";
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from "@angular/core";
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withNavigationErrorHandler,
  withRouterResources,
} from "@angular/router";
import { routes } from "./app.routes";
import { provideHttpClient } from "@angular/common/http";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterResources(),
      withNavigationErrorHandler((error) => {
        const router = inject(Router);
        if (error.error?.message) {
          console.error("Navigation error occurred:", error.error.message);
        }
        router.navigate(["/error"]);
      }),
    ),
    provideHttpClient(),
    provideTaiga(),
  ],
};
