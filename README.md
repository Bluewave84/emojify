# emojify

Pictures made of little expressions

## Emoji color tree

`public/emojiKdTree.bin` maps colors to emojis. Rebuild it from a [noto-emoji](https://github.com/googlefonts/noto-emoji) checkout:

```sh
npm run emoji-color-tree -- --source ../noto-emoji
# or: NOTO_EMOJI_DIR=../noto-emoji npm run emoji-color-tree
```

`--source` can be the repo root, its `2D`/`3D` folder, or a folder of `emoji_u*.png` files. Run with `--help` for all options (`--size`, `--style`, `--dry-run`, `--strict`, …).

Each run prints a summary and writes `tmp/emoji-color-tree/report.html` and `report.json`: missing or empty PNGs, PNGs that aren't in `EMOJI_LIST`, emojis that are never picked because another one has the same color, near-identical pairs, and a check of tree lookups against brute force.
