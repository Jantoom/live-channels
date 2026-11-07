// Stremio fills the poster tile with the image and crops what doesn't fit, which
// cuts the sides off wide logos. Each logo is redrawn centred on a transparent
// square with a margin, so the whole logo shows.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SIZE = 400, MARGIN = 32;
// Bump to regenerate every cached poster after changing the drawing.
const VERSION = 1;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

export const posterFile = (logoUrl) =>
  `${createHash("sha1").update(`${VERSION}|${logoUrl}`).digest("hex").slice(0, 16)}.png`;

export async function renderPoster(image) {
  const inner = SIZE - 2 * MARGIN;
  return sharp(image)
    .resize(inner, inner, { fit: "contain", background: CLEAR })
    .extend({ top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, background: CLEAR })
    .png()
    .toBuffer();
}

/**
 * Writes the poster for a logo into outDir and returns its file name. Rendered
 * posters are kept in cacheDir so later builds only fetch new or changed logos
 * (the logo URLs change when the image does).
 */
export async function makePoster(logoUrl, { fetchImpl, cacheDir, outDir }) {
  const file = posterFile(logoUrl);
  const cached = join(cacheDir, file);
  let png = await readFile(cached).catch(() => null);
  if (!png) {
    const res = await fetchImpl(logoUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    png = await renderPoster(Buffer.from(await res.arrayBuffer()));
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cached, png);
  }
  await writeFile(join(outDir, file), png);
  return file;
}
