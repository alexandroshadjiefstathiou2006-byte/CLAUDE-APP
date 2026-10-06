/** Image helpers for preparing provider inputs. */
import sharp from "sharp";

export interface ImageBytes {
  data: Buffer;
  mimeType: string;
}

/**
 * Normalize a reference image for AI providers:
 * - rasterizes SVG (providers only accept raster formats)
 * - caps the longest side (keeps detail for logos/prints, avoids huge payloads)
 * - outputs PNG (lossless — important for text/logo fidelity)
 */
export async function toProviderImage(img: ImageBytes, maxSide = 1536): Promise<ImageBytes> {
  const pipeline = sharp(img.data, { density: img.mimeType === "image/svg+xml" ? 300 : undefined }).rotate();
  const meta = await pipeline.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const resized = longest > maxSide ? pipeline.resize({ width: meta.width! >= meta.height! ? maxSide : undefined, height: meta.height! > meta.width! ? maxSide : undefined }) : pipeline;
  // flatten transparency onto white so providers don't invent backgrounds behind cut-outs
  const data = await resized.flatten({ background: "#ffffff" }).png().toBuffer();
  return { data, mimeType: "image/png" };
}

export async function imageSize(data: Buffer) {
  const m = await sharp(data).metadata();
  return { width: m.width, height: m.height };
}

export const isRaster = (mimeType: string) => /^image\/(png|jpe?g|webp)$/.test(mimeType);
