import { OklabKDTree } from "./oklab-kd-tree";

describe("OklabKDTree", () => {
  it("finds every indexed color after recursively partitioning the tree", () => {
    const levels = [0, 127, 255];
    const colors = levels.flatMap((r) => levels.flatMap((g) => levels.map((b) => ({ r, g, b }))));
    const tree = new OklabKDTree(colors.map((color, id) => ({ id, color })));

    colors.forEach((color, id) => {
      expect(tree.findNearestColor(color)).toEqual({
        id,
        squaredOklabDistance: 0,
      });
    });
  });

  it("returns the k nearest colors in ascending distance, matching a brute-force search", () => {
    const levels = [0, 60, 127, 190, 255];
    const colors = levels.flatMap((r) => levels.flatMap((g) => levels.map((b) => ({ r, g, b }))));
    const tree = new OklabKDTree(colors.map((color, id) => ({ id, color })));
    const queries = [
      { r: 10, g: 200, b: 90 },
      { r: 250, g: 5, b: 128 },
      { r: 128, g: 128, b: 128 },
    ];

    queries.forEach((query) => {
      const nearest = tree.findNearestColors(query, 7);
      expect(nearest).toHaveLength(7);
      expect(nearest[0]).toEqual(tree.findNearestColor(query));
      for (let i = 1; i < nearest.length; i++) {
        expect(nearest[i].squaredOklabDistance).toBeGreaterThanOrEqual(
          nearest[i - 1].squaredOklabDistance,
        );
      }

      const bruteForce = colors
        .map((_, id) => {
          const single = new OklabKDTree([{ id, color: colors[id] }]).findNearestColor(query);
          return single!.squaredOklabDistance;
        })
        .sort((x, y) => x - y)
        .slice(0, 7);
      expect(nearest.map((n) => n.squaredOklabDistance)).toEqual(
        bruteForce.map((d) => expect.closeTo(d, 12)),
      );
      expect(tree.findNearestColors(query, 0)).toEqual([]);
    });
  });

  it("returns all colors when asking for more than indexed", () => {
    const tree = new OklabKDTree([
      { id: 0, color: { r: 0, g: 0, b: 0 } },
      { id: 1, color: { r: 255, g: 255, b: 255 } },
    ]);
    expect(tree.findNearestColors({ r: 0, g: 0, b: 0 }, 5).map((n) => n.id)).toEqual([0, 1]);
  });
});
