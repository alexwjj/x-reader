import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
assert.equal(pkg.version, lock.version);
assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'The extension has no runtime npm dependencies.');
const packages = Object.entries(lock.packages).filter(([name]) => name);
for (const [name, dependency] of packages) {
  assert.ok(dependency.resolved, `A dependency has no locked download URL: ${name}`);
  const url = new URL(dependency.resolved);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'registry.npmjs.org', `Non-public registry for ${name}`);
  assert.ok(dependency.integrity, `Missing integrity: ${name}`);
}
assert.equal((await readFile(join(root, '.npmrc'), 'utf8')).trim(), 'registry=https://registry.npmjs.org/');
const ignored = new Set(['node_modules', '.git', 'dist', 'coverage', 'playwright-report', 'test-results', '.DS_Store']);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (ignored.has(entry.name) || relative(root, file).startsWith('docs/superpowers')) continue;
    assert.ok(!entry.isSymbolicLink(), `Review symlink before publication: ${relative(root, file)}`);
    if (entry.isDirectory()) await walk(file);
    else files.push(file);
  }
}
await walk(root);
for (const file of files) {
  const name = relative(root, file);
  assert.ok(!/(?:^|\/)\.env(?:\.|$)|\.pem$|\.key$|\.log$/i.test(name), `Private/local file in public inventory: ${name}`);
  if (/\.(?:png|jpg|jpeg|zip)$/i.test(name)) continue;
  const text = await readFile(file, 'utf8');
  assert.ok(!/\/(?:Users|home)\/[^\s/]+\//.test(text), `Local user path: ${name}`);
  assert.ok(!/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `Credential-like content: ${name}`);
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>`)]+/g)) {
    let url;
    try { url = new URL(match[0]); } catch { continue; }
    assert.ok(!url.username && !url.password, `Credentials in a URL: ${name}`);
    const host = url.hostname;
    assert.ok(!/(?:^|\.)(?:internal|intranet|corp|local|xiaojukeji\.com)$/.test(host), `Private host in ${name}`);
    assert.ok(!/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host), `Private IP in ${name}`);
  }
}
const assets = [
  ['store-icon-128.png', 128, 128],
  ['screenshot-light-1280x800.png', 1280, 800],
  ['screenshot-dark-1280x800.png', 1280, 800],
  ['promo-small-440x280.png', 440, 280],
  ['promo-marquee-1400x560.png', 1400, 560],
  ['readme-hero-1280x640.png', 1280, 640]
];
for (const [name, width, height] of assets) {
  const png = await readFile(join(root, 'docs/store', name));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), width, name);
  assert.equal(png.readUInt32BE(20), height, name);
}
console.log(`Public inventory checked: ${files.length} files; ${packages.length} locked packages from public npm; ${assets.length} store images have valid dimensions.`);
