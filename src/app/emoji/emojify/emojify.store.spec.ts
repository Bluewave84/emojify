import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router, UrlTree } from "@angular/router";
import { vi } from "vitest";
import { EmojiService } from "../shared/emoji.service";
import { EMOJIFY_ROUTES, requireImage } from "./emojify.routes";
import { EmojifyStore, MOSAIC_PIPELINE, RENDER_DEBOUNCE_MS } from "./emojify.store";

describe("EmojifyStore", () => {
  const file = new File(["image"], "sample.png", { type: "image/png" });
  const parts = [
    { row: 0, col: 0, color: [10, 20, 30, 255] },
    { row: 0, col: 1, color: [0, 0, 0, 0] },
  ];
  let http: HttpTestingController;
  let store: EmojifyStore;
  let analyzeImageParts: ReturnType<typeof vi.fn>;
  let createEmojiImage: ReturnType<typeof vi.fn>;
  let emojify: ReturnType<typeof vi.fn>;
  let signals: AbortSignal[];

  beforeEach(() => {
    vi.useFakeTimers();
    signals = [];
    analyzeImageParts = vi.fn(async (_doc, _url, _size, signal: AbortSignal) => {
      signals.push(signal);
      return parts;
    });
    createEmojiImage = vi.fn(async () => "data:image/png;base64,mosaic");
    emojify = vi.fn(() => [{ row: 0, col: 0, emoji: "00a9" }]);
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
        { provide: MOSAIC_PIPELINE, useValue: { analyzeImageParts, createEmojiImage } },
        {
          provide: EmojiService,
          useValue: { ready: signal(true), error: signal(null), emojify },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(EmojifyStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Lets the effect schedule, waits out the debounce and answers the sprite request. */
  async function settle() {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(RENDER_DEBOUNCE_MS);
    for (const request of http.match("emoji-sprite.svg")) request.flush("<svg></svg>");
    await vi.advanceTimersByTimeAsync(0);
  }

  it("rejects unsupported files and keeps no image", () => {
    expect(store.load(new File(["x"], "a.gif", { type: "image/gif" }))).toBe(false);
    expect(store.error()).toContain("PNG, JPG, or WebP");
    expect(store.hasImage()).toBe(false);
  });

  it("renders only while the result step is active", async () => {
    store.load(file);
    await settle();
    expect(analyzeImageParts).not.toHaveBeenCalled();

    store.resultActive.set(true);
    await settle();
    expect(analyzeImageParts).toHaveBeenCalledTimes(1);
    expect(emojify).toHaveBeenCalledWith([parts[0]], { mode: "best", topN: 5 });
    expect(store.mosaic()).toBe("data:image/png;base64,mosaic");
    expect(store.busy()).toBe(false);
  });

  it("debounces quick changes into one render", async () => {
    store.load(file);
    store.resultActive.set(true);
    TestBed.tick();
    store.setTileSize(32);
    TestBed.tick();
    store.setTopN(8);
    TestBed.tick();
    store.setBackground("#ffffffff");
    expect(store.busy()).toBe(true);
    await settle();

    expect(analyzeImageParts).toHaveBeenCalledTimes(1);
    expect(analyzeImageParts.mock.calls[0][2]).toBe(32);
    expect(createEmojiImage).toHaveBeenCalledTimes(1);
  });

  it("aborts a running render when a newer change arrives", async () => {
    let finish: (value: typeof parts) => void = () => undefined;
    analyzeImageParts.mockImplementationOnce(
      (_doc, _url, _size, signal: AbortSignal) =>
        new Promise((resolve) => {
          signals.push(signal);
          finish = resolve;
        }),
    );
    store.load(file);
    store.resultActive.set(true);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(RENDER_DEBOUNCE_MS);
    expect(signals).toHaveLength(1);

    store.setTileSize(48);
    TestBed.tick();
    expect(signals[0].aborted).toBe(true);
    finish(parts);
    await settle();

    expect(analyzeImageParts).toHaveBeenCalledTimes(2);
    expect(createEmojiImage).toHaveBeenCalledTimes(1);
    expect(createEmojiImage.mock.calls[0][2]).toBe(48);
  });

  it("reuses the analysis when only the emoji choice or background changes", async () => {
    store.load(file);
    store.resultActive.set(true);
    await settle();

    store.setSelectionMode("random");
    await settle();
    expect(analyzeImageParts).toHaveBeenCalledTimes(1);
    expect(emojify).toHaveBeenCalledTimes(2);

    store.setBackground("#00000000");
    await settle();
    expect(analyzeImageParts).toHaveBeenCalledTimes(1);
    expect(emojify).toHaveBeenCalledTimes(2);
    expect(createEmojiImage).toHaveBeenCalledTimes(3);
    expect(createEmojiImage.mock.calls[2][5]).toBeNull();
    expect(store.transparent()).toBe(true);

    store.setAdjustment("brightness", 120);
    await settle();
    expect(analyzeImageParts).toHaveBeenCalledTimes(2);
  });

  it("reports a whole-image background removal instead of rendering", async () => {
    analyzeImageParts.mockResolvedValue([{ row: 0, col: 0, color: [0, 0, 0, 0] }]);
    store.load(file);
    store.resultActive.set(true);
    await settle();
    expect(store.error()).toContain("background removal covers the whole image");
    expect(createEmojiImage).not.toHaveBeenCalled();
    expect(store.busy()).toBe(false);
  });

  it("shows a sprite failure and clears the busy state", async () => {
    store.load(file);
    store.resultActive.set(true);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(RENDER_DEBOUNCE_MS);
    http.expectOne("emoji-sprite.svg").flush(null, { status: 404, statusText: "Not Found" });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.error()).toContain("Could not create the mosaic");
    expect(store.busy()).toBe(false);
    expect(store.mosaic()).toBeNull();
  });

  it("releases the object URL and settings on reset", async () => {
    store.load(file);
    store.setScale(150);
    store.reset();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:sample");
    expect(store.hasImage()).toBe(false);
    expect(store.prepare().scale).toBe(100);
  });

  it("sends the result step back to prepare without an image", () => {
    const run = () => TestBed.runInInjectionContext(() => requireImage({} as never, {} as never));
    const redirect = run() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(redirect)).toBe("/prepare");
    store.load(file);
    expect(run()).toBe(true);
  });
});
