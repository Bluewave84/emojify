import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideTaiga } from "@taiga-ui/core";
import { vi } from "vitest";
import { EmojiService } from "../shared/emoji.service";
import { Emojify } from "./emojify.page";
import { EmojiSizeSelect } from "./ui/emoji-size-select";

describe("Emojify workflow", () => {
  let http: HttpTestingController;
  let dataReady = signal(true);
  const file = new File(["image"], "sample.png", { type: "image/png" });

  beforeEach(() => {
    vi.resetAllMocks();
    dataReady = signal(true);
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
      imports: [Emojify],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTaiga(),
        {
          provide: EmojiService,
          useValue: {
            ready: dataReady,
            error: signal(null),
            emojify: vi.fn(() => [{ row: 0, col: 0, emoji: "00a9" }]),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it("previews a selected image, then resets it and releases the original URL", async () => {
    const fixture = TestBed.createComponent(Emojify);
    const page = fixture.componentInstance;
    page.selectFile(file);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('img[alt="Original image"]')).toBeTruthy();
    expect(page.canCreate()).toBe(true);
    expect(page.busy()).toBe(false);
    page.reset();
    expect(page.selectedFile()).toBeNull();
    expect(page.imageSource()).toBeNull();
    expect(page.mosaicSource()).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:sample");
  });

  it("waits for emoji data before enabling creation", () => {
    const page = TestBed.createComponent(Emojify).componentInstance;
    dataReady.set(false);
    page.selectFile(file);
    expect(page.canCreate()).toBe(false);
  });

  it("defaults to a black background and supports transparency or a custom color", async () => {
    const fixture = TestBed.createComponent(Emojify);
    const page = fixture.componentInstance;
    await fixture.whenStable();

    expect(page.transparentBackground()).toBe(false);
    expect(page.backgroundColor()).toBe("#000000");
    expect(fixture.nativeElement.querySelector('input[type="color"]').value).toBe("#000000");

    const transparent = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    transparent.click();
    expect(page.transparentBackground()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="color"]')).toBeNull();

    transparent.click();
    fixture.detectChanges();
    const color = fixture.nativeElement.querySelector('input[type="color"]') as HTMLInputElement;
    color.value = "#123456";
    color.dispatchEvent(new Event("input"));
    expect(page.backgroundColor()).toBe("#123456");
  });

  it("does not publish a result after reset during creation", async () => {
    const page = TestBed.createComponent(Emojify).componentInstance;
    page.selectFile(file);
    const creating = page.create();
    const request = http.expectOne("emoji-sprite.svg");
    page.reset();
    await creating;
    expect(request.cancelled).toBe(true);
    expect(page.mosaicSource()).toBeNull();
    expect(page.busy()).toBe(false);
  });

  it("shows a sprite request failure and clears the busy state", async () => {
    const page = TestBed.createComponent(Emojify).componentInstance;
    page.selectFile(file);
    const creating = page.create();
    http.expectOne("emoji-sprite.svg").flush(null, { status: 404, statusText: "Not Found" });
    await creating;
    expect(page.error()).toBeTruthy();
    expect(page.busy()).toBe(false);
    expect(page.mosaicSource()).toBeNull();
  });

  it("updates the tile size from the fixed Taiga slider stops", async () => {
    const fixture = TestBed.createComponent(EmojiSizeSelect);
    await fixture.whenStable();
    const slider = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement | null;

    expect(slider).not.toBeNull();
    if (!slider) return;

    expect(slider.min).toBe("16");
    expect(slider.max).toBe("64");
    expect(slider.step).toBe("16");
    slider.value = "48";
    slider.dispatchEvent(new Event("input"));
    await fixture.whenStable();

    expect(fixture.componentInstance.size()).toBe(48);
  });

  it("updates the selection mode from the chosen Taiga radio", async () => {
    const fixture = TestBed.createComponent(Emojify);
    await fixture.whenStable();
    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]');

    radios[1].click();

    expect(fixture.componentInstance.selection().mode).toBe("random");
  });
});
