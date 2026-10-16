import { OklabKDTree } from "./oklab-kd-tree";

describe("OklabKDTree", () => {
  it("finds every indexed color after recursively partitioning the tree", () => {
    const levels = [0, 127, 255];
    const colors = levels.flatMap((r) =>
      levels.flatMap((g) => levels.map((b) => ({ r, g, b }))),
    );
    const tree = new OklabKDTree(colors.map((color, id) => ({ id, color })));

    colors.forEach((color, id) => {
      expect(tree.findNearestColor(color)).toEqual({
        id,
        squaredOklabDistance: 0,
      });
    });
  });
});
