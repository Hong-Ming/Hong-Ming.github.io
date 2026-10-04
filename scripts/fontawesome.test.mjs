import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderFontAwesome, fontAwesomeInputs } from './fontawesome.mjs';
import { renderFontAwesomeFonts } from './fontawesome-fonts.mjs';
import fontverter from 'fontverter';
import { Blob, Face, Font } from 'harfbuzzjs';

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
  assert.match(output, /fa-solid-900-subset\.woff2/);
  assert.doesNotMatch(output, /fa-brands-400|fa-regular-400|\.eot|\.ttf|\.svg|format\("woff"\)/);
});

test('supports brands, regular and legacy solid style, quoted and unquoted classes', () => {
  const { output, iconCount } = renderFontAwesome(root, page(`
    <i title="a > b; class='fas fa-camera'" class='fab fa-github'></i>
    <i class="far&#32;fa-circle"></i>
    <i class=fa\n data-ignored="fa-camera"></i>
    <i class="fa fa-home"></i>
  `));
  assert.equal(iconCount, 3);
  for (const font of ['brands-400', 'solid-900', 'regular-400']) assert.ok(output.includes(`fa-${font}-subset.woff2`));
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

async function fontFace(buffer) {
  return new Face(new Blob(await fontverter.convert(buffer, 'sfnt')));
}

test('subsets each family independently and preserves icon outlines and metrics', async () => {
  const { fonts } = renderFontAwesome(root, page(`
    <i class="fab fa-github"></i><i class="fas fa-envelope"></i>
    <i class="fas fa-circle"></i><i class="far fa-circle"></i>
  `));
  const outputs = await renderFontAwesomeFonts(root, fonts);
  assert.equal(outputs.length, 3);
  for (const result of outputs) {
    assert.equal(result.output.toString('ascii', 0, 4), 'wOF2');
    assert.ok(result.output.length < result.originalBytes / 2);
    const originalFace = await fontFace(readFileSync(join(root, result.input)));
    const subsetFace = await fontFace(result.output);
    assert.deepEqual([...subsetFace.collectUnicodes()], result.codes);
    assert.equal(subsetFace.upem, originalFace.upem);
    const original = new Font(originalFace);
    const subset = new Font(subsetFace);
    assert.deepEqual(subset.hExtents(), original.hExtents());
    for (const code of result.codes) {
      const originalGlyph = original.nominalGlyph(code);
      const subsetGlyph = subset.nominalGlyph(code);
      assert.ok(subsetGlyph);
      assert.equal(subset.glyphHAdvance(subsetGlyph), original.glyphHAdvance(originalGlyph));
      assert.deepEqual(subset.glyphExtents(subsetGlyph), original.glyphExtents(originalGlyph));
      assert.equal(subset.glyphToPath(subsetGlyph), original.glyphToPath(originalGlyph));
    }
  }
  const repeat = await renderFontAwesomeFonts(root, fonts);
  outputs.forEach((result, index) => assert.ok(result.output.equals(repeat[index].output)));
});

test('rejects an icon unavailable in its selected font family', async () => {
  const { fonts } = renderFontAwesome(root, page('<i class="fab fa-envelope"></i>'));
  await assert.rejects(renderFontAwesomeFonts(root, fonts), /unavailable in webfonts\/fa-brands-400\.woff2/);
});

test('build includes new icons from shared HTML and JSON; check detects stale CSS and fonts', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'fontawesome-build-'));
  try {
    cpSync(join(root, 'src'), join(fixture, 'src'), { recursive: true });
    mkdirSync(join(fixture, 'scripts'));
    for (const file of ['build.mjs', 'entries.mjs', 'fontawesome.mjs', 'fontawesome-fonts.mjs']) cpSync(join(root, 'scripts', file), join(fixture, 'scripts', file));
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    for (const file of fontAwesomeInputs) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      cpSync(join(root, file), join(fixture, file));
    }
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
    const solidFile = join(fixture, 'webfonts/fa-solid-900-subset.woff2');
    const solid = readFileSync(solidFile);
    const codes = new Set((await fontFace(solid)).collectUnicodes());
    assert.ok(codes.has(0xf030), 'new camera icon is included in the font');
    assert.ok(codes.has(0xf005), 'new star icon from JSON is included in the font');
    writeFileSync(solidFile, Buffer.concat([solid, Buffer.from([0])]));
    const staleFont = run('--check');
    assert.notEqual(staleFont.status, 0);
    assert.match(staleFont.stderr, /fa-solid-900-subset\.woff2/);
    assert.equal(run().status, 0);
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
    assert.ok(readFileSync(solidFile).equals(solid));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
