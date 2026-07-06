/**
 * Regenerates the PWA icon PNGs from the brand SVGs in public/icons/
 * (logo.svg → icon-192/512 + apple-touch-icon, maskable.svg → maskable-512).
 *
 * Requires sharp (not a project dependency — install ad hoc):
 *   npm i -D sharp && node scripts/gen-icons.mjs && npm rm sharp
 *
 * The generated PNGs are committed, so this only needs to run when the
 * logo itself changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. Run: npm i -D sharp && node scripts/gen-icons.mjs");
  process.exit(1);
}

const logo = readFileSync(join(iconsDir, "logo.svg"));
const maskable = readFileSync(join(iconsDir, "maskable.svg"));

async function render(svg, size, name) {
  await sharp(svg, { density: Math.ceil((72 * size) / 512) + 72 })
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, name));
  console.log(`${name} (${size}x${size}) written`);
}

await render(logo, 512, "icon-512.png");
await render(logo, 192, "icon-192.png");
await render(logo, 180, "apple-touch-icon.png");
await render(maskable, 512, "maskable-512.png");
