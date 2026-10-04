import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { inlineStyles } from './styles.mjs';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('inlines only active local styles in place; preserves cascade, media, licenses, and asset URLs', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'inline-css-'));
  try {
    mkdirSync(join(fixture, 'css'));
    writeFileSync(join(fixture, 'css/first.css'), `/*! license */
      @font-face { font-family: Test; src: url('../webfonts/test.woff2'); size-adjust: 98.4513%; }
      .same { color: red; background: url('../image/test.png?version=1#piece'); }
      @media (max-width: 600px) { .same { width: calc(100% - 30px); } }
    `);
    writeFileSync(join(fixture, 'css/last.css'), '.same { color: blue; } .label:before { content: "</style>"; }');
    const html = `<!doctype html><head>
      <!-- <link rel="stylesheet" href="missing.css"> -->
      <script>const example = '<link rel="stylesheet" href="missing.css">';</script>
      <link href="../../css/first.css" rel="stylesheet" media="screen and (min-width: 1px)">
      <style>.same { color: green; }</style>
      <link rel="stylesheet" href="https://example.com/external.css">
      <link rel="preload" as="font" href="/webfonts/test.woff2">
      <link rel=stylesheet href=/css/last.css>
      </head>`;
    const output = inlineStyles(fixture, { name: 'posts/example/index.html', html });
    assert.ok(output.indexOf('color:red') < output.indexOf('color: green'));
    assert.ok(output.indexOf('color: green') < output.indexOf('color:#00f'));
    assert.match(output, /media="screen and \(min-width: 1px\)"/);
    assert.match(output, /\/\*! license \*\//);
    assert.match(output, /size-adjust:98\.4513%/);
    assert.match(output, /\.\.\/\.\.\/webfonts\/test\.woff2/);
    assert.match(output, /\.\.\/\.\.\/image\/test\.png\?version=1#piece/);
    assert.match(output, /@media \(max-width:600px\)/);
    assert.match(output, /href="https:\/\/example.com\/external.css"/);
    assert.match(output, /rel="preload"/);
    assert.match(output, /content:"\\3c \/style>"/);
    assert.match(output, /<!-- <link rel="stylesheet" href="missing.css"> -->/);
    assert.match(output, /const example = '<link rel="stylesheet" href="missing.css">'/);
    const home = inlineStyles(fixture, { name: 'index.html', html: '<link rel="stylesheet" href="/css/first.css">' });
    assert.match(home, /url\(['"]?webfonts\/test\.woff2['"]?\)/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('uses fresh generated CSS and fails on missing or malformed stylesheet inputs', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'inline-generated-'));
  try {
    const path = join(fixture, 'css/generated.css');
    const page = { name: 'index.html', html: '<link rel="stylesheet" href="/css/generated.css">' };
    assert.match(inlineStyles(fixture, page, new Map([[path, '.fresh { color: red; }']])), /\.fresh\{color:red\}/);
    assert.throws(() => inlineStyles(fixture, page), /ENOENT/);
    assert.throws(() => inlineStyles(fixture, page, new Map([[path, '.bad { color }']])), /Cannot inline/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('check and watch rebuild when CSS or original images change without a rebuild loop', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'inline-build-'));
  let watcher;
  try {
    for (const name of ['src', 'scripts', 'css', 'webfonts', 'image']) {
      cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    const run = (...args) => spawnSync(process.execPath, [join(fixture, 'scripts/build.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    const file = join(fixture, 'css/main.css');
    const original = readFileSync(file, 'utf8');
    writeFileSync(file, original + '\n.watch-proof { color: red; }');
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /index.html/);
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);

    let output = '';
    watcher = spawn(process.execPath, [join(fixture, 'scripts/build.mjs'), '--watch'], { stdio: ['ignore', 'pipe', 'pipe'] });
    watcher.stdout.on('data', (chunk) => { output += chunk; });
    watcher.stderr.on('data', (chunk) => { output += chunk; });
    const waitFor = async (predicate) => {
      const deadline = Date.now() + 10000;
      while (!predicate()) {
        if (Date.now() > deadline) assert.fail('Watch mode timed out: ' + output);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    await waitFor(() => output.includes('Watching'));
    writeFileSync(file, original + '\n.watch-proof { color: blue; }');
    await waitFor(() => readFileSync(join(fixture, 'index.html'), 'utf8').includes('.watch-proof{color:#00f}'));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal((output.match(/Built 7 pages/g) ?? []).length, 2, output);
    assert.equal(run('--check').status, 0);
    const photo = join(fixture, 'image/myphoto.jpg');
    const generatedPhoto = join(fixture, 'image/generated/myphoto-168.webp');
    const before = readFileSync(generatedPhoto);
    writeFileSync(photo, await sharp(readFileSync(photo)).jpeg({ quality: 60 }).toBuffer());
    await waitFor(() => !readFileSync(generatedPhoto).equals(before));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal((output.match(/Built 7 pages/g) ?? []).length, 3, output);
    assert.equal(run('--check').status, 0);
  } finally {
    if (watcher && watcher.exitCode === null) {
      watcher.kill();
      await new Promise((resolve) => watcher.once('close', resolve));
    }
    rmSync(fixture, { recursive: true, force: true });
  }
});
