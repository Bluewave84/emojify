import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { generateEmojiColorTree } from "./emoji-color-tree/generate";
import { summarize, writeReport } from "./emoji-color-tree/report";

const HELP = `Builds public/emojiKdTree.bin from the noto-emoji PNGs and writes a report of what landed in the tree.

Usage: npm run emoji-color-tree -- --source <dir> [options]

  --source <dir>       noto-emoji checkout, its 2D/3D folder, or a folder of emoji_u*.png files
                       (default: $NOTO_EMOJI_DIR)
  --style <2D|3D>      style folder inside a noto-emoji checkout (default: 2D)
  --size <px>          PNG size folder: 32, 72, 128 or 512 (default: 32)
  --out <file>         tree binary to write (default: public/emojiKdTree.bin)
  --report <dir>       where report.html and report.json go (default: tmp/emoji-color-tree)
  --concurrency <n>    PNGs decoded in parallel (default: 32)
  --verify <n>         random lookups checked against brute force (default: 2000)
  --strict             fail when PNGs are missing or empty, or lookups don't verify
  --dry-run            analyze and report, but don't write the tree binary
  -h, --help           show this help
`;

const main = async () => {
  const { values } = parseArgs({
    options: {
      source: { type: "string", default: process.env["NOTO_EMOJI_DIR"] },
      style: { type: "string", default: "2D" },
      size: { type: "string", default: "32" },
      out: { type: "string", default: "public/emojiKdTree.bin" },
      report: { type: "string", default: "tmp/emoji-color-tree" },
      concurrency: { type: "string", default: "32" },
      verify: { type: "string", default: "2000" },
      strict: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }
  if (!values.source) {
    console.error("Missing --source (or NOTO_EMOJI_DIR).\n");
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  const result = await generateEmojiColorTree(
    {
      source: path.resolve(values.source),
      style: values.style,
      size: Number(values.size),
      concurrency: Number(values.concurrency),
      verifySamples: Number(values.verify),
    },
    (done, total) => {
      if (process.stdout.isTTY) process.stdout.write(`\rAnalyzing ${done}/${total}`);
    },
  );
  if (process.stdout.isTTY) process.stdout.write("\n");

  const problems = result.missing.length + result.empty.length + result.verification.mismatches;
  const failStrict = values.strict && problems > 0;

  let outFile: string | null = null;
  let outBytes = 0;
  if (!values["dry-run"] && !failStrict) {
    outFile = path.resolve(values.out);
    const { buffer } = result.tree.exportBinary();
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, new Uint8Array(buffer));
    outBytes = buffer.byteLength;
  }

  const { htmlFile } = await writeReport(result, path.resolve(values.report));
  console.log(summarize(result, outFile, outBytes));
  console.log(`Report:       ${htmlFile}`);

  if (failStrict) {
    console.error("\n--strict: missing/empty PNGs or failed lookups, so the tree was not written.");
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("Error generating emoji color tree:", error);
  process.exitCode = 1;
});
