import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderFontAwesome, fontAwesomeInputs } from './fontawesome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = (html) => [{ name: 'index.html', html }];

test('retains selected glyphs, shared helpers, animations, and license notice', () => {
  const { output, iconCount } = renderFontAwesome(root, page('<i class="fas fa-envelope fa-spin fa-fw"></i>'));
  assert.equal(iconCount, 1);
  assert.match(output, /\.fa-envelope:before\s*\{\s*content: "\\f0e0"/);
  assert.doesNotMatch(output, /\.fa-github:before/);
  assert.match(output, /\.fa-ul/);
  assert.match(output, /\.fa-li/);
  assert.match(output, /@keyframes fa-spin/);
  assert.match(output, /\.sr-only/);
  assert.match(output, /Code: MIT License/);
  assert.match(output, /fa-solid-900\.woff2/);
  assert.doesNotMatch(output, /fa-brands-400\.woff2|fa-regular-400\.woff2/);
});

test('supports brands, regular and legacy solid style, quoted and unquoted classes', () => {
  const { output, iconCount } = renderFontAwesome(root, page(`
    <i title="a > b; class='fas fa-camera'" class='fab fa-github'></i>
    <i class="far&#32;fa-circle"></i>
    <i class=fa\n data-ignored="fa-camera"></i>
    <i class="fa fa-home"></i>
  `));
  assert.equal(iconCount, 3);
  for (const font of ['brands-400', 'solid-900', 'regular-400']) assert.ok(output.includes(`fa-${font}.woff2`));
  assert.doesNotMatch(output, /\.fa-camera:before/);
});

test('ignores disabled icons, script strings and escaped HTML examples', () => {
  const { output, iconCount } = renderFontAwesome(root, page(`
    <!-- <i class="fab fa-facebook-f"></i> -->
    <script>const example = '<i class="fas fa-camera"></i>';</script>
    <code>&lt;i class="fas fa-star"&gt;&lt;/i&gt;</code>
    <i class="fas fa-bars"></i>
  `));
  assert.equal(iconCount, 1);
  assert.doesNotMatch(output, /\.fa-(facebook-f|camera|star):before/);
});

test('reports unavailable icons and unsupported styles', () => {
  assert.throws(() => renderFontAwesome(root, page('<i class="fas fa-does-not-exist"></i>')), /Unknown Font Awesome class.*index.html/);
  assert.throws(() => renderFontAwesome(root, page('<i class="fal fa-envelope"></i>')), /not included in this Free library/);
});

test('build includes new icons from shared HTML and JSON; check detects stale CSS', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'fontawesome-build-'));
  try {
    cpSync(join(root, 'src'), join(fixture, 'src'), { recursive: true });
    mkdirSync(join(fixture, 'scripts'));
    for (const file of ['build.mjs', 'entries.mjs', 'fontawesome.mjs']) cpSync(join(root, 'scripts', file), join(fixture, 'scripts', file));
    mkdirSync(join(fixture, 'css'));
    for (const file of fontAwesomeInputs) cpSync(join(root, file), join(fixture, file));
    const run = (...args) => spawnSync(process.execPath, [join(fixture, 'scripts/build.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    const footer = join(fixture, 'src/includes/footer.html');
    writeFileSync(footer, readFileSync(footer, 'utf8') + '\n<i class="fas fa-camera"></i>\n');
    const dataFile = join(fixture, 'src/data/projects.json');
    const projects = JSON.parse(readFileSync(dataFile, 'utf8'));
    const entry = projects.find((project) => project.enabled !== false);
    entry.descriptionHtml += '<i class="fas fa-star"></i>';
    writeFileSync(dataFile, JSON.stringify(projects));
    assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0);
    const outputFile = join(fixture, 'css/fontawesome-subset.css');
    const output = readFileSync(outputFile, 'utf8');
    assert.match(output, /\.fa-camera:before/);
    assert.match(output, /\.fa-star:before/);
    assert.equal(run('--check').status, 0);
    writeFileSync(outputFile, output + '/* stale */');
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /css\/fontawesome-subset.css/);
    assert.equal(run().status, 0);
    const htmlBefore = readFileSync(join(fixture, 'index.html'), 'utf8');
    writeFileSync(footer, readFileSync(footer, 'utf8') + '<i class="fas fa-does-not-exist"></i>');
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(join(fixture, 'index.html'), 'utf8'), htmlBefore);
    assert.equal(readFileSync(outputFile, 'utf8'), output);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
