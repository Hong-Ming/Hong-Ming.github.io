import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { imageInputs, renderResponsiveImages, renderImageAttributes } from './images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('responsive images are smaller, retain proportions and logo transparency, and leave originals untouched', async () => {
  const originals = new Map(imageInputs.map((input) => [input, readFileSync(join(root, input))]));
  const { images, assets } = await renderResponsiveImages(root);
  assert.equal(assets.length, 11);
  for (const image of images) {
    const original = originals.get(image.input);
    const source = await sharp(original).metadata();
    for (const variant of image.variants) {
      const metadata = await sharp(variant.output).metadata();
      assert.equal(metadata.width, variant.width);
      assert.ok(Math.abs(metadata.height - metadata.width * source.height / source.width) <= 1);
      assert.ok(variant.output.length < original.length, variant.name);
      if (image.logo) {
        assert.ok(metadata.hasAlpha, 'logo alpha channel is retained');
        const expected = await sharp(original).rotate().resize({ width: variant.width }).ensureAlpha().raw().toBuffer();
        const actual = await sharp(variant.output).ensureAlpha().raw().toBuffer();
        assert.equal(actual.length, expected.length);
        // Fully transparent pixels can have different invisible RGB values.
        for (let i = 0; i < actual.length; i += 4) {
          assert.equal(actual[i + 3], expected[i + 3], 'alpha stays lossless');
          if (actual[i + 3]) {
            for (let channel = 0; channel < 3; channel++) assert.equal(actual[i + channel], expected[i + channel], 'visible logo pixels stay lossless');
          }
        }
      }
    }
    assert.ok(readFileSync(join(root, image.input)).equals(original));
  }
  const again = await renderResponsiveImages(root);
  assets.forEach((asset, index) => assert.ok(asset.output.equals(again.assets[index].output)));
});

test('homepage image attributes provide density choices and defer only timeline logos', async () => {
  const { images } = await renderResponsiveImages(root);
  const photo = renderImageAttributes(images, 'myphoto');
  assert.match(photo, /myphoto-168\.webp 168w, .*myphoto-336\.webp 336w/);
  assert.match(photo, /sizes="168px" width="168" height="168" loading="eager"/);
  assert.doesNotMatch(photo, /loading="lazy"/);
  for (const key of ['uiuc_logo', 'nycu_logo', 'usc_logo']) {
    const attributes = renderImageAttributes(images, key);
    assert.match(attributes, /40w, .*80w, .*120w/);
    assert.match(attributes, /sizes="\(max-width: 600px\) 30px, 40px"/);
    assert.match(attributes, /loading="lazy" decoding="async"/);
  }
  assert.throws(() => renderImageAttributes(images, 'missing'), /Unknown responsive image/);
});

test('check detects stale image bytes and changed originals; bad image inputs cannot partially overwrite outputs', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'image-build-'));
  try {
    for (const name of ['src', 'scripts', 'css', 'webfonts', 'image']) cpSync(join(root, name), join(fixture, name), { recursive: true });
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    const run = (...args) => spawnSync(process.execPath, [join(fixture, 'scripts/build.mjs'), ...args], { encoding: 'utf8' });
    const built = run();
    assert.equal(built.status, 0, built.stderr);
    const asset = join(fixture, 'image/generated/myphoto-168.webp');
    const bytes = readFileSync(asset);
    writeFileSync(asset, Buffer.concat([bytes, Buffer.from('stale')]));
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /image\/generated\/myphoto-168\.webp/);
    assert.equal(run().status, 0);
    const originalPhoto = join(fixture, 'image/myphoto.jpg');
    writeFileSync(originalPhoto, await sharp(readFileSync(originalPhoto)).jpeg({ quality: 60 }).toBuffer());
    assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0);
    const updated = readFileSync(asset);
    assert.ok(!updated.equals(bytes));
    assert.equal(run('--check').status, 0);
    const before = readFileSync(join(fixture, 'index.html'));
    writeFileSync(join(fixture, 'image/nycu_logo.png'), Buffer.from('invalid image'));
    assert.notEqual(run().status, 0);
    assert.ok(readFileSync(join(fixture, 'index.html')).equals(before));
    assert.ok(readFileSync(asset).equals(updated));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
