import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { crc32 } from './binary.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
if (pkg.version !== manifest.version) throw new Error('manifest.json and package.json versions differ.');
async function collect(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? collect(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}
// An explicit allowlist includes current on-disk changes, never development files or local secrets.
const names = ['manifest.json', 'LICENSE', 'README.md', 'PRIVACY.md', ...await collect('src'), ...await collect('icons')]
  .filter(name => !name.split('/').some(part => part.startsWith('.'))).sort();
const localFiles = [];
const centralFiles = [];
let offset = 0;
for (const name of names) {
  const filename = Buffer.from(name);
  const original = await readFile(join(root, name));
  const compressed = deflateRawSync(original, { level: 9 });
  const crc = crc32(original);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(33, 12); // Fixed 1980-01-01 timestamp makes identical inputs reproducible.
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(original.length, 22);
  local.writeUInt16LE(filename.length, 26);
  localFiles.push(local, filename, compressed);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  local.copy(central, 6, 4, 28);
  central.writeUInt32LE(offset, 42);
  centralFiles.push(central, filename);
  offset += local.length + filename.length + compressed.length;
}
const directory = Buffer.concat(centralFiles);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(names.length, 8);
end.writeUInt16LE(names.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const output = join(root, 'dist', `x-reader-${pkg.version}.zip`);
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(output, Buffer.concat([...localFiles, directory, end]));
console.log(`Packaged ${names.length} files → ${output}`);
