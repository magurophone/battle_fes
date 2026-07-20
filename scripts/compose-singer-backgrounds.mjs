import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKGROUND_DIR = path.join(ROOT, "背景");
const BADGE_PATH = path.join(
  ROOT,
  "public",
  "assets",
  "promo",
  "bonus",
  "char-9-trans.png",
);

// ColorSing reference layout:
//   0%–15.5%   icon / viewing status / song title
//   15.5%–57%  usable middle band
//   57%–100%   lyrics / comments
// Badge placements stay entirely inside the usable middle band and avoid each
// artwork's existing song-title treatment.
const COMPOSITIONS = [
  {
    input: "2c6a8896-938e-4dce-96d5-28e2d0ec999f.png",
    output: "insight_貫通BONUS_9-9.png",
    badgeWidthRatio: 0.3,
    leftRatio: 0.35,
    topRatio: 0.17,
  },
  {
    input: "ChatGPT Image 2026年7月18日 18_46_54.png",
    output: "66号線_貫通BONUS_9-9.png",
    badgeWidthRatio: 0.25,
    leftRatio: 0.7,
    topRatio: 0.165,
  },
  {
    input: "ChatGPT Image 2026年7月18日 18_47_09.png",
    output: "ロックンロールイズノットデッド_貫通BONUS_9-9.png",
    badgeWidthRatio: 0.22,
    leftRatio: 0.75,
    topRatio: 0.17,
  },
];

const SAFE_TOP_RATIO = 0.155;
const SAFE_BOTTOM_RATIO = 0.57;

for (const item of COMPOSITIONS) {
  const inputPath = path.join(BACKGROUND_DIR, item.input);
  const outputPath = path.join(BACKGROUND_DIR, item.output);
  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new Error(`Could not read image dimensions: ${inputPath}`);
  }

  const badgeWidth = Math.round(width * item.badgeWidthRatio);
  const left = Math.round(width * item.leftRatio);
  const top = Math.round(height * item.topRatio);
  const badgeBuffer = await sharp(BADGE_PATH)
    .resize({ width: badgeWidth, fit: "contain" })
    .png()
    .toBuffer();
  const badgeMetadata = await sharp(badgeBuffer).metadata();
  const badgeHeight = badgeMetadata.height ?? badgeWidth;
  const safeTop = Math.ceil(height * SAFE_TOP_RATIO);
  const safeBottom = Math.floor(height * SAFE_BOTTOM_RATIO);

  if (left < 0 || left + badgeWidth > width) {
    throw new Error(`Badge exceeds horizontal canvas for ${item.output}`);
  }
  if (top < safeTop || top + badgeHeight > safeBottom) {
    throw new Error(
      `Badge exceeds safe vertical band for ${item.output}: ` +
        `${top}–${top + badgeHeight}, safe ${safeTop}–${safeBottom}`,
    );
  }

  await sharp(inputPath)
    .composite([{ input: badgeBuffer, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  console.log(
    JSON.stringify({
      output: path.relative(ROOT, outputPath),
      canvas: `${width}x${height}`,
      badge: { left, top, width: badgeWidth, height: badgeHeight },
      safeBand: { top: safeTop, bottom: safeBottom },
    }),
  );
}
