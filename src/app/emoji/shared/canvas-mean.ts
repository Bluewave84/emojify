import { RGBColor } from "./kd-tree";

export const analyzeEmoji = (filepath: string): Promise<RGBColor> =>
  new Promise((resolve, reject) => {
    if (!filepath.trim()) {
      reject(new Error("A PNG URL is required."));
      return;
    }

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          throw new Error("Could not create a 2D canvas context.");
        }

        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let red = 0;
        let green = 0;
        let blue = 0;
        let visiblePixels = 0;

        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] === 0) {
            continue;
          }

          red += data[index];
          green += data[index + 1];
          blue += data[index + 2];
          visiblePixels += 1;
        }

        if (visiblePixels === 0) {
          throw new Error("The PNG contains no visible pixels.");
        }

        const rnd = (channel: number) => Math.round(channel / visiblePixels);

        resolve({ r: rnd(red), g: rnd(green), b: rnd(blue) });
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`Could not load PNG: ${filepath}`));
    image.src = filepath;
  });
