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
});
