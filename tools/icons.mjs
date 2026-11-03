import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { crc32 } from './binary.mjs';

const destination = new URL('../icons/', import.meta.url);
await mkdir(destination, { recursive: true });
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function rounded(x, y, left, top, width, height, radius) {
  const dx = Math.max(left + radius - x, 0, x - (left + width - radius));
  const dy = Math.max(top + radius - y, 0, y - (top + height - radius));
  return x >= left && x <= left + width && y >= top && y <= top + height && dx * dx + dy * dy <= radius * radius;
}
function color(x, y) {
  if (!rounded(x, y, 0, 0, 128, 128, 30)) return [0, 0, 0, 0];
  for (const top of [35, 59, 83]) if (rounded(x, y, 28, top, 9, 9, 3)) return [255, 255, 255, 255];
  for (const [top, width] of [[36, 51], [60, 38], [84, 46]]) if (rounded(x, y, 49, top, width, 7, 3.5)) return [255, 255, 255, 255];
  return [15, 20, 25, 255];
}
for (const size of [16, 32, 48, 128]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const pixel = color((x + (sx + .5) / 4) * 128 / size, (y + (sy + .5) / 4) * 128 / size);
      for (let channel = 0; channel < 4; channel++) sum[channel] += pixel[channel];
    }
    for (let channel = 0; channel < 4; channel++) raw[y * (size * 4 + 1) + 1 + x * 4 + channel] = Math.round(sum[channel] / 16);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  await writeFile(new URL(`${size}.png`, destination), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]));
}
console.log('Generated icons: 16, 32, 48, 128px');
