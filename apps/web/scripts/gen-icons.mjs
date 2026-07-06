/**
 * Generates placeholder PWA icons (solid dark background, blue circle)
 * into public/icons/. Replace them with real brand icons any time —
 * keep the same filenames and sizes.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BG = [0x0b, 0x0d, 0x10]; // #0b0d10
const ACCENT = [0x3b, 0x82, 0xf6]; // #3b82f6

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, circleRatio) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  const center = size / 2;
  const radius = size * circleRatio;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inCircle = (x - center) ** 2 + (y - center) ** 2 <= radius ** 2;
      const [r, g, b] = inCircle ? ACCENT : BG;
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "icon-192.png"), png(192, 0.34));
writeFileSync(join(outDir, "icon-512.png"), png(512, 0.34));
// maskable: keep the mark inside the ~40% safe zone
writeFileSync(join(outDir, "maskable-512.png"), png(512, 0.26));
writeFileSync(join(outDir, "apple-touch-icon.png"), png(180, 0.34));

console.log(`Icons written to ${outDir}`);
