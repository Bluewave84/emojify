// Creates src/styles/tokens.css from design/tokens.json.
// Command: npm run tokens
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));

const defaultTheme = tokens.color.themes[0].id;
const themeIds = tokens.color.themes.map((theme) => theme.id);

/** Token value for a specific theme; if missing, the value of the first theme is used. */
function valueFor(token, themeId) {
  if (typeof token.value === "string") return token.value;
  return token.value[themeId] ?? token.value[defaultTheme];
}

/** Aliases like "{other-token}" are converted to var(--other-token). */
function resolveAlias(value) {
  return value.replace(/^\{([^}]+)\}$/, "var(--$1)");
}

function themedBlock(themeId) {
  const lines = [];
  for (const token of tokens.color.tokens) {
    lines.push(`  --${token.name}: ${resolveAlias(valueFor(token, themeId))};`);
  }
  for (const token of tokens.shadow?.tokens ?? []) {
    lines.push(`  --${token.name}: ${valueFor(token, themeId)};`);
  }
  return lines.join("\n");
}

const staticLines = [];
for (const [key, family] of Object.entries(tokens.type.families)) {
  staticLines.push(`  --font-${key}: ${family};`);
}
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    const prefix = `--type-${style.name}`;
    staticLines.push(`  ${prefix}-family: var(--font-${group.family});`);
    staticLines.push(`  ${prefix}-size: ${style.fontSize};`);
    staticLines.push(`  ${prefix}-line: ${style.lineHeight};`);
    staticLines.push(`  ${prefix}-weight: ${style.fontWeight};`);
    if (style.letterSpacing) staticLines.push(`  ${prefix}-tracking: ${style.letterSpacing};`);
  }
}
for (const token of tokens.spacing.tokens) staticLines.push(`  --${token.name}: ${token.value};`);
for (const token of tokens.radius.tokens) staticLines.push(`  --${token.name}: ${token.value};`);

const blocks = [
  `/* ${tokens.name} — generated from tokens.json (npm run tokens). Do not edit by hand. */`,
];
blocks.push(
  `:root,\n[data-theme='${defaultTheme}'] {\n  color-scheme: ${defaultTheme};\n${themedBlock(defaultTheme)}\n}`,
);
for (const themeId of themeIds.slice(1)) {
  blocks.push(
    `[data-theme='${themeId}'] {\n  color-scheme: ${themeId};\n${themedBlock(themeId)}\n}`,
  );
}
blocks.push(`:root {\n${staticLines.join("\n")}\n}`);

writeFileSync(resolve(root, "src/styles/tokens.css"), blocks.join("\n\n") + "\n");
console.log("src/styles/tokens.css written");
