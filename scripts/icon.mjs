// Writes build/icon.png (256×256) for the desktop app: "LF" over a blue/red team stripe.
// Plain Node (zlib), no image libraries, so the icon is generated like every other asset.
import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 256;
const BG = [0x12, 0x18, 0x21];
const WHITE = [0xf4, 0xf6, 0xf8];
const BLUE = [0x2f, 0x7d, 0xe1];
const RED = [0xe5, 0x48, 0x3b];
const RADIUS = 44;

const px = new Uint8Array(SIZE * SIZE * 4);
const set = (x, y, [r, g, b], a = 255) => {
  const i = (y * SIZE + x) * 4;
  px.set([r, g, b, a], i);
};
const rect = (x0, y0, w, h, c) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c);
};

// Rounded dark square.
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = Math.max(RADIUS - x, x - (SIZE - 1 - RADIUS), 0);
    const dy = Math.max(RADIUS - y, y - (SIZE - 1 - RADIUS), 0);
    if (dx * dx + dy * dy <= RADIUS * RADIUS) set(x, y, BG);
  }
}
// "L"
rect(48, 52, 30, 120, WHITE);
rect(48, 142, 72, 30, WHITE);
// "F"
rect(136, 52, 30, 120, WHITE);
rect(136, 52, 76, 28, WHITE);
rect(136, 98, 60, 26, WHITE);
// Team stripe.
rect(48, 190, 80, 18, BLUE);
rect(128, 190, 84, 18, RED);

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(rows, y * (SIZE * 4 + 1) + 1);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rows)),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('build', { recursive: true });
writeFileSync('build/icon.png', png);
console.log('build/icon.png written');
