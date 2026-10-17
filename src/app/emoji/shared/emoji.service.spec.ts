import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { EMOJIS } from "./color-tree/emoji-list";
import { EmojiService } from "./emoji.service";

describe("EmojiService", () => {
  let service: EmojiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(EmojiService);
  });

  afterEach(() => http.verify());

  it("loads binary nodes and preserves the image grid when matching colors", () => {
    expect(service.ready()).toBe(false);
    const request = http.expectOne("/emojiKdTree.bin");
    expect(request.request.responseType).toBe("arraybuffer");
    request.flush(new Float64Array([0, 0, 0, 0, -1, -1]).buffer);

    expect(service.ready()).toBe(true);
    expect(service.emojify([{ row: 2, col: 3, color: [0, 0, 0, 255] }])).toEqual([
      { row: 2, col: 3, emoji: EMOJIS[0] },
    ]);
  });

  it("exposes HTTP errors without throwing an unhandled signal error", () => {
    http.expectOne("/emojiKdTree.bin").flush(null, { status: 404, statusText: "Not Found" });
    expect(service.ready()).toBe(false);
    expect(service.error()).toBeTruthy();
    expect(() => service.emojify([])).toThrow("KD-Tree not loaded yet.");
  });

  it("reports malformed binary data", () => {
    http.expectOne("/emojiKdTree.bin").flush(new ArrayBuffer(1));
    expect(service.ready()).toBe(false);
    expect(service.error()).toBeTruthy();
  });

  describe("emoji selection", () => {
    const black = { row: 0, col: 0, color: [0, 0, 0, 255] as [number, number, number, number] };
    const tiles = [0, 1, 2, 3].map((col) => ({ ...black, col }));

    beforeEach(() => {
      // Three nodes: black (id 0, root), dark gray (id 1), white (id 2)
      http
        .expectOne("/emojiKdTree.bin")
        .flush(
          new Float64Array([0.2, 0, 0, 1, 6, 12, 0, 0, 0, 0, -1, -1, 1, 0, 0, 2, -1, -1]).buffer,
        );
    });

    it("picks the closest emoji by default", () => {
      expect(service.emojify(tiles).map((p) => p.emoji)).toEqual(Array(4).fill(EMOJIS[0]));
    });

    it("cycles through the top N emojis in round robin mode", () => {
      expect(service.emojify(tiles, { mode: "roundRobin", topN: 2 }).map((p) => p.emoji)).toEqual([
        EMOJIS[0],
        EMOJIS[1],
        EMOJIS[0],
        EMOJIS[1],
      ]);
    });

    it("picks randomly among the top N emojis", () => {
      const rolls = [0.99, 0, 0.5, 0.4];
      const result = service.emojify(tiles, { mode: "random", topN: 3 }, () => rolls.shift()!);
      expect(result.map((p) => p.emoji)).toEqual([EMOJIS[2], EMOJIS[0], EMOJIS[1], EMOJIS[1]]);
    });
  });
});
