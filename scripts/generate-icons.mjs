// Generates PWA icons (PNG) from a simple inline SVG mark, no external deps.
// Uses sharp if available; falls back to writing a tiny placeholder PNG.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "public/icons");
await mkdir(root, { recursive: true });

const SIZES = [192, 512];
const MASKABLE_SIZE = 512;
const APPLE_SIZE = 180;

const FG = "#e8e6df";
const BG = "#161616";

function svg(size, padding = 0.18) {
  const r = size * 0.18;
  const inset = Math.round(size * padding);
  const inner = size - inset * 2;
  // Microphone glyph: capsule body + stand + base
  const cx = size / 2;
  const top = inset;
  const bodyH = inner * 0.55;
  const bodyW = inner * 0.32;
  const stickH = inner * 0.18;
  const baseW = inner * 0.46;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
  <g fill="${FG}">
    <rect x="${cx - bodyW / 2}" y="${top}" width="${bodyW}" height="${bodyH}" rx="${bodyW / 2}" ry="${bodyW / 2}"/>
    <rect x="${cx - 4}" y="${top + bodyH + 8}" width="8" height="${stickH}" rx="2"/>
    <rect x="${cx - baseW / 2}" y="${top + bodyH + stickH + 12}" width="${baseW}" height="10" rx="5"/>
  </g>
</svg>`;
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  sharp = null;
}

async function writeSvg(name, size) {
  const buf = Buffer.from(svg(size));
  await writeFile(resolve(root, name + ".svg"), buf);
  if (sharp) {
    const png = await sharp(buf).png().toBuffer();
    await writeFile(resolve(root, name + ".png"), png);
  } else {
    // Without sharp, write the SVG as a placeholder .png.svg so the manifest
    // still finds *something*. The user can run `npm i -D sharp && node scripts/generate-icons.mjs`
    // to materialize real PNGs later.
    await writeFile(resolve(root, name + ".png"), buf);
  }
}

for (const size of SIZES) {
  await writeSvg(`icon-${size}`, size);
}

// Maskable: more padding so the mark survives platform safe-area cropping.
{
  const buf = Buffer.from(svg(MASKABLE_SIZE, 0.28));
  await writeFile(resolve(root, "icon-maskable-512.svg"), buf);
  if (sharp) {
    const png = await sharp(buf).png().toBuffer();
    await writeFile(resolve(root, "icon-maskable-512.png"), png);
  } else {
    await writeFile(resolve(root, "icon-maskable-512.png"), buf);
  }
}

// Apple touch icon
{
  const buf = Buffer.from(svg(APPLE_SIZE));
  await writeFile(resolve(root, "apple-touch-icon.svg"), buf);
  if (sharp) {
    const png = await sharp(buf).png().toBuffer();
    await writeFile(resolve(root, "apple-touch-icon.png"), png);
  } else {
    await writeFile(resolve(root, "apple-touch-icon.png"), buf);
  }
}

console.log(
  sharp
    ? "icons: generated PNGs via sharp"
    : "icons: sharp not installed — wrote SVGs as .png placeholders. Run `npm i -D sharp && node scripts/generate-icons.mjs` for real PNGs.",
);
