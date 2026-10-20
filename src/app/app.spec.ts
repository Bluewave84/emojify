import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { provideTaiga } from "@taiga-ui/core";
import { App } from "./app";
import { routes } from "./app.routes";
import { ThemeService } from "./ui";

describe("App", () => {
  const noop = () => undefined;

  beforeEach(async () => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addListener: noop,
          removeListener: noop,
          addEventListener: noop,
          removeEventListener: noop,
          dispatchEvent: () => true,
        }) as MediaQueryList,
    });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideTaiga()],
    }).compileComponents();
  });

  it("should create the app", () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("sets data-theme on the document root", async () => {
    const fixture = TestBed.createComponent(App);
    const theme = TestBed.inject(ThemeService);
    theme.set("light");
    await fixture.whenStable();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
