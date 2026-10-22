import {
  analyzeImageParts,
  backgroundAlpha,
  backgroundFill,
  createEmojiImage,
  extractEmojiSvg,
} from "./mosaic-renderer";

describe("mosaic rendering", () => {
  const spriteText =
    '<svg xmlns="http://www.w3.org/2000/svg"><svg id="emoji_u00a9" x="128" y="256" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="paint" /></defs><path fill="url(#paint)" d="M0 0h128v128z" /></svg></svg>';

  it("extracts an emoji without atlas offsets and keeps its gradients and viewBox", () => {
    const sprite = new DOMParser().parseFromString(spriteText, "image/svg+xml");
    const result = new DOMParser().parseFromString(
      extractEmojiSvg(sprite, "00a9"),
      "image/svg+xml",
    );
    expect(result.documentElement.hasAttribute("x")).toBe(false);
    expect(result.documentElement.hasAttribute("y")).toBe(false);
    expect(result.documentElement.getAttribute("viewBox")).toBe("0 0 128 128");
    expect(result.querySelector("linearGradient")?.id).toBe("paint");
    expect(result.querySelector("path")?.getAttribute("fill")).toBe("url(#paint)");
  });

  it("reports missing emoji artwork", () => {
    const sprite = new DOMParser().parseFromString(spriteText, "image/svg+xml");
    expect(() => extractEmojiSvg(sprite, "missing")).toThrow("Emoji artwork not found");
  });

  it("rejects empty mosaics", async () => {
    await expect(createEmojiImage(document, [], 16, spriteText)).rejects.toThrow("empty");
  });

  it("rejects an invalid sprite document", async () => {
    await expect(
      createEmojiImage(document, [{ row: 0, col: 0, emoji: "00a9" }], 16, "<svg>"),
    ).rejects.toThrow("Invalid emoji sprite");
  });

  it("stops analysis and rendering when their operation has been cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      analyzeImageParts(document, "unused", 16, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      createEmojiImage(
        document,
        [{ row: 0, col: 0, emoji: "00a9" }],
        16,
        spriteText,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("turns hexa background values into canvas fills", () => {
    expect(backgroundFill("#00000000")).toBeNull();
    expect(backgroundFill("#FFFFFFFF")).toBe("#ffffff");
    expect(backgroundFill("#112233")).toBe("#112233");
    expect(backgroundFill("#ff000080")).toBe("rgba(255, 0, 0, 0.502)");
    expect(() => backgroundFill("red")).toThrow("Invalid color");
    expect(backgroundAlpha("#ff000080")).toBe(128);
    expect(backgroundAlpha("#ff0000")).toBe(255);
  });
});
