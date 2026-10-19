export interface EmojiAnalysisCsvRow {
  filename: `emoji_u${string}.png`;
  srgb: `(${number}, ${number}, ${number})`;
  cielab: `(${number}, ${number}, ${number})`;
  transparency: `${number}`;
  "edge-density": `${number}`;
  status: "active" | "inactive";
  reason: string;
}
