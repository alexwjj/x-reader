import { readdir, readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : join(directory, entry.name)))).flat();
}
const sources = (await Promise.all(['src', 'tools', 'tests'].map(name => files(join(root, name))))).flat();
for (const file of sources.filter(file => /\.(?:m?js)$/.test(file))) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) await access(resolve(dirname(file), match[1]));
}
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version, 'Keep manifest.json and package.json versions in sync.');
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal(manifest.host_permissions, undefined, 'Content script matches are sufficient.');
for (const script of manifest.content_scripts) {
  for (const name of [...script.js, ...(script.css || [])]) await access(join(root, name));
  assert.ok(script.matches.every(pattern => /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/\*$/.test(pattern)));
}
await access(join(root, manifest.action.default_popup));
for (const [size, file] of Object.entries(manifest.icons)) {
  const png = await readFile(join(root, file));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
}
for (const file of sources.filter(file => file.endsWith('.html'))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^https?:/.test(match[1]), 'Extension pages must use local assets.');
    await access(resolve(dirname(file), match[1]));
  }
  assert.ok(!/<script\b[^>]*>\s*\S[^]*?<\/script>/.test(source), 'Use external extension-owned JavaScript files.');
}
console.log(`Checked ${sources.filter(file => /\.(?:m?js)$/.test(file)).length} JavaScript files, local imports, HTML assets, manifest permissions, version and icons.`);
