import { expect, type Page } from "@playwright/test";

/** The red/ivory fixtures must not acquire saturated green fringes from transparent floor shadows. */
export async function expectNeutralShadows(
  page: Page,
  bytes: Buffer,
): Promise<void> {
  const shadowArtifacts = await page.evaluate(
    async (png) => {
      const image = new Image();
      image.src = png;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let artifacts = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i + 3] > 1 &&
          pixels[i + 3] < 90 &&
          pixels[i + 1] > pixels[i] + 70 &&
          pixels[i + 1] > pixels[i + 2] + 70
        )
          artifacts++;
      }
      return artifacts;
    },
    `data:image/png;base64,${bytes.toString("base64")}`,
  );
  expect(shadowArtifacts).toBe(0);
}
