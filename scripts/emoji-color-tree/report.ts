import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RGBColor } from "../../src/app/emoji/shared/color-tree/types";
import type { GenerateResult, TreeEmoji } from "./generate";

/** Emojis closer than this (Oklab distance) are listed as near twins. ~0.02 is a just-noticeable difference. */
const NEAR_TWIN_DISTANCE = 0.01;

export const summarize = (result: GenerateResult, outFile: string | null, outBytes: number) => {
  const { emojis, missing, empty, unlisted, verification, timings } = result;
  const shadowed = emojis.filter((emoji) => emoji.shadowedBy);
  const twins = emojis.filter(
    (emoji) => emoji.nearest && emoji.nearest.distance < NEAR_TWIN_DISTANCE,
  );
  const ms = (value: number) => `${Math.round(value)} ms`;

  return [
    `Source:       ${result.pngDir}`,
    `In tree:      ${emojis.length} emojis`,
    `Missing PNG:  ${missing.length}${preview(missing.map((m) => m.name))}`,
    `Empty PNG:    ${empty.length}${preview(empty.map((m) => m.name))}`,
    `Not listed:   ${unlisted.length} PNGs in the folder are not in EMOJI_LIST${preview(unlisted)}`,
    `Never picked: ${shadowed.length} emojis share their color with another one${preview(shadowed.map((s) => s.name))}`,
    `Near twins:   ${twins.length} emojis have another one closer than ${NEAR_TWIN_DISTANCE} (Oklab)`,
    `Verified:     ${verification.samples - verification.mismatches}/${verification.samples} random lookups match brute force`,
    `Timings:      analyze ${ms(timings.analyzeMs)}, build ${ms(timings.buildMs)}, insights ${ms(timings.insightsMs)}`,
    outFile ? `Written:      ${outFile} (${outBytes} bytes)` : `Written:      nothing`,
  ].join("\n");
};

export const writeReport = async (result: GenerateResult, reportDir: string) => {
  await fs.mkdir(reportDir, { recursive: true });

  const json = {
    pngDir: result.pngDir,
    timings: result.timings,
    verification: result.verification,
    missing: result.missing,
    empty: result.empty,
    unlisted: result.unlisted,
    emojis: result.emojis.map(
      ({ id, name, color, oklab, coverage, partialAlpha, nearest, shadowedBy }) => ({
        id,
        name,
        hex: toHex(color),
        oklab,
        coverage,
        partialAlpha,
        nearest,
        shadowedBy,
      }),
    ),
  };
  const jsonFile = path.join(reportDir, "report.json");
  await fs.writeFile(jsonFile, JSON.stringify(json, null, 2));

  const htmlFile = path.join(reportDir, "report.html");
  await fs.writeFile(htmlFile, renderHtml(result));

  return { jsonFile, htmlFile };
};

const renderHtml = (result: GenerateResult) => {
  const imageBase = pathToFileURL(result.pngDir + path.sep).href;
  const img = (file: string) => `<img src="${imageBase}${file}" width="32" height="32" alt="">`;

  const byHue = [...result.emojis].sort((x, y) => hue(x) - hue(y) || x.oklab.l - y.oklab.l);
  const twins = result.emojis
    .filter((emoji) => emoji.nearest && emoji.nearest.distance < NEAR_TWIN_DISTANCE)
    .sort((x, y) => x.nearest!.distance - y.nearest!.distance);
  const byId = new Map(result.emojis.map((emoji) => [emoji.id, emoji]));

  const tile = (emoji: TreeEmoji) => {
    const hex = toHex(emoji.color);
    const title = [
      `${emoji.name} (#${emoji.id})`,
      hex,
      `L ${emoji.oklab.l.toFixed(3)} a ${emoji.oklab.a.toFixed(3)} b ${emoji.oklab.b.toFixed(3)}`,
      `coverage ${pct(emoji.coverage)}, partly transparent ${pct(emoji.partialAlpha)}`,
      emoji.nearest ? `nearest ${emoji.nearest.name} (${emoji.nearest.distance.toFixed(4)})` : "",
      emoji.shadowedBy ? `never picked, shadowed by ${emoji.shadowedBy.name}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const cls = emoji.shadowedBy ? "tile shadowed" : "tile";
    return `<div class="${cls}" title="${escape(title)}">${img(emoji.file)}<span style="background:${hex}"></span></div>`;
  };

  const pair = (emoji: TreeEmoji) => {
    const other = byId.get(emoji.nearest!.id)!;
    return `<tr><td>${img(emoji.file)} ${emoji.name}</td><td>${img(other.file)} ${other.name}</td><td>${emoji.nearest!.distance.toFixed(4)}</td><td>${emoji.shadowedBy ? "yes" : ""}</td></tr>`;
  };

  const list = (title: string, names: string[]) =>
    names.length === 0
      ? ""
      : `<details><summary>${title} (${names.length})</summary><p class="mono">${names.map(escape).join(" ")}</p></details>`;

  const { verification, timings } = result;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Emoji color tree report</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 24px; }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .stats div { border: 1px solid #8884; border-radius: 8px; padding: 8px 12px; }
  .stats b { display: block; font-size: 1.4em; }
  .grid { display: flex; flex-wrap: wrap; gap: 2px; }
  .tile { display: flex; flex-direction: column; width: 32px; }
  .tile span { height: 8px; }
  .tile.shadowed { outline: 2px solid crimson; }
  table { border-collapse: collapse; }
  td, th { padding: 2px 8px; text-align: left; vertical-align: middle; }
  td img { vertical-align: middle; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.85em; word-break: break-all; }
</style>
</head>
<body>
<h1>Emoji color tree report</h1>
<p class="mono">${escape(result.pngDir)}</p>
<div class="stats">
  <div><b>${result.emojis.length}</b>in tree</div>
  <div><b>${result.missing.length}</b>missing PNG</div>
  <div><b>${result.empty.length}</b>empty PNG</div>
  <div><b>${result.unlisted.length}</b>PNGs not in list</div>
  <div><b>${result.emojis.filter((e) => e.shadowedBy).length}</b>never picked</div>
  <div><b>${twins.length}</b>near twins</div>
  <div><b>${verification.samples - verification.mismatches}/${verification.samples}</b>lookups verified</div>
  <div><b>${Math.round(timings.analyzeMs + timings.buildMs)} ms</b>analyze + build</div>
</div>
${list(
  "Missing PNGs",
  result.missing.map((m) => m.name),
)}
${list(
  "Empty PNGs",
  result.empty.map((m) => m.name),
)}
${list("PNGs not in EMOJI_LIST", result.unlisted)}
<h2>All emojis by hue</h2>
<p>Each tile shows the emoji and the average color it is matched by. Red outline: never picked, because another emoji has the same color. Hover for details.</p>
<div class="grid">${byHue.map(tile).join("")}</div>
<h2>Near twins (Oklab distance &lt; ${NEAR_TWIN_DISTANCE})</h2>
<table><thead><tr><th>Emoji</th><th>Nearest</th><th>Distance</th><th>Never picked</th></tr></thead>
<tbody>${twins.map(pair).join("")}</tbody></table>
</body>
</html>
`;
};

const preview = (names: string[], max = 8) =>
  names.length === 0
    ? ""
    : ` (${names.slice(0, max).join(", ")}${names.length > max ? ", …" : ""})`;

/** Achromatic emojis go first, then by hue angle. */
const hue = (emoji: TreeEmoji) => {
  const chroma = Math.hypot(emoji.oklab.a, emoji.oklab.b);
  return chroma < 0.02 ? -10 : Math.atan2(emoji.oklab.b, emoji.oklab.a);
};

const toHex = ({ r, g, b }: RGBColor) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

const pct = (value: number) => `${Math.round(value * 100)}%`;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
