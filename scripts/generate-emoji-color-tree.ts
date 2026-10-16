import { generateEmojiColorTree } from "./emoji-color-tree/utils";

generateEmojiColorTree("C:\\Users\\Christoph.Kuhn\\source\\repos\\noto-emoji\\2D")
  .then(() => {
    console.log("Emoji color tree generated successfully.");
  })
  .catch((error) => {
    console.error("Error generating emoji color tree:", error);
  });
