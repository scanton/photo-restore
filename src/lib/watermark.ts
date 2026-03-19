import { Jimp, loadFont, measureText, measureTextHeight } from "jimp";
import { SANS_32_WHITE } from "jimp/fonts";
import { BlendMode } from "@jimp/core";

/**
 * Burns a semi-transparent "PREVIEW — Photo Restore" watermark diagonally
 * across the center of the image.
 *
 * Returns a JPEG buffer.
 */
export async function burnWatermark(inputBuffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(inputBuffer);

  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // Load a white bitmap font
  const font = await loadFont(SANS_32_WHITE);

  const text = "PREVIEW — Photo Restore";

  // Measure text so we can center it
  const textWidth = measureText(font, text);
  const textHeight = measureTextHeight(font, text, textWidth + 1);

  // Create a transparent overlay the same size as the image
  const overlay = new Jimp({ width, height, color: 0x00000000 });

  // Print text centered on the overlay
  const x = Math.floor((width - textWidth) / 2);
  const y = Math.floor((height - textHeight) / 2);

  overlay.print({ font, x, y, text });

  // Reduce opacity of the overlay to 40%
  overlay.opacity(0.4);

  // Rotate overlay for diagonal watermark effect
  overlay.rotate(-30);

  // Composite the overlay onto the image
  image.composite(overlay, 0, 0, {
    mode: BlendMode.SRC_OVER,
    opacitySource: 0.4,
    opacityDest: 1,
  });

  // Return as JPEG buffer
  const outputBuffer = await image.getBuffer("image/jpeg", { quality: 85 });
  return outputBuffer;
}
