import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideTaiga } from "@taiga-ui/core";
import { vi } from "vitest";
import { EmojiService } from "../shared/emoji.service";
import { EMOJIFY_ROUTES } from "./emojify.routes";
import { EmojifyStore, MOSAIC_PIPELINE } from "./emojify.store";
import { PrepareStep } from "./prepare/prepare-step";
import { MosaicRail } from "./result/mosaic-rail";

describe("Emojify steps", () => {
  const file = new File(["image"], "sample.png", { type: "image/png" });

  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      media: "",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = vi.fn(() => "blob:sample");
        static override revokeObjectURL = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(EMOJIFY_ROUTES),
        provideTaiga(),
        {
          provide: MOSAIC_PIPELINE,
          useValue: { analyzeImageParts: vi.fn(), createEmojiImage: vi.fn() },
        },
        {
          provide: EmojiService,
          useValue: { ready: signal(true), error: signal(null), emojify: vi.fn(() => []) },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it("starts with a drop zone and continues to the result once an image is loaded", async () => {
    const fixture = TestBed.createComponent(PrepareStep);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const continueButton = () =>
      [...element.querySelectorAll("button")].find((b) => b.textContent?.includes("Continue"));

    expect(element.querySelector("label[tuiInputFiles]")).toBeTruthy();
    expect(continueButton()?.disabled).toBe(true);

    TestBed.inject(EmojifyStore).load(file);
    await fixture.whenStable();
    expect(element.querySelector('img[alt="Adjusted image"]')).toBeTruthy();
    expect(element.querySelector("label[tuiInputFiles]")).toBeNull();

    const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    continueButton()?.click();
    expect(navigate).toHaveBeenCalledWith(["/result"]);
  });

  it("updates the emoji choice and background from the mosaic settings", async () => {
    const fixture = TestBed.createComponent(MosaicRail);
    await fixture.whenStable();
    const store = TestBed.inject(EmojifyStore);
    const radio = (name: string, index: number) =>
      fixture.nativeElement.querySelectorAll(`input[name="${name}"]`)[index] as HTMLInputElement;

    radio("emoji-mode", 1).click();
    expect(store.selection().mode).toBe("random");
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("#variety")).toBeTruthy();

    radio("background-preset", 0).click();
    expect(store.background()).toBe("#00000000");
    expect(store.transparent()).toBe(true);
  });
});
