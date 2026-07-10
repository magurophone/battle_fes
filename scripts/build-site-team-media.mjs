import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDir = path.resolve("public/assets/site-team-v1");

const backgrounds = [
  ["public/assets/teams/crimson.png", "crimson-bg.webp"],
  ["public/assets/teams/nova.png", "nova-bg.webp"],
  ["public/assets/teams/golden.png", "golden-bg.webp"],
];

const members = [
  ["public/assets/members/crimson-leader.png", "crimson-leader.webp"],
  ["public/assets/members/crimson-ngogo.jpg", "crimson-ngogo.webp"],
  ["public/assets/members/crimson-pk.jpeg", "crimson-pk.webp"],
  ["public/assets/members/nova-leader.jpg", "nova-leader.webp"],
  ["public/assets/members/nova-naporu.jpg", "nova-naporu.webp"],
  ["public/assets/members/nova-neko.jpg", "nova-neko.webp"],
  ["public/assets/members/golden-iran-july.jpg", "golden-iran.webp"],
  ["public/assets/members/golden-awa.jpg", "golden-awa.webp"],
  ["public/assets/members/golden-tera.jpg", "golden-tera.webp"],
];

await mkdir(outputDir, { recursive: true });

for (const [input, output] of backgrounds) {
  await sharp(input)
    .webp({ quality: 84, effort: 5 })
    .toFile(path.join(outputDir, output));
}

for (const [input, output] of members) {
  await sharp(input)
    .resize(512, 512, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 5 })
    .toFile(path.join(outputDir, output));
}

const outputs = [...backgrounds, ...members].map(([, output]) => output);
const sizes = await Promise.all(outputs.map(async (output) => ({
  file: output,
  bytes: (await stat(path.join(outputDir, output))).size,
})));

console.table(sizes);
