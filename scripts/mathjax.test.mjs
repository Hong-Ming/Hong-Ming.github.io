import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, symlinkSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('MathJax is opt-in per page, expands shared configuration first, and keeps direct Analytics', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'mathjax-build-'));
  try {
    for (const name of ['src', 'scripts', 'css', 'webfonts', 'image']) cpSync(join(root, name), join(fixture, name), { recursive: true });
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    const run = (...args) => spawnSync(process.execPath, [join(fixture, 'scripts/build.mjs'), ...args], { encoding: 'utf8' });
    const built = run();
    assert.equal(built.status, 0, built.stderr);
    const homeOutput = join(fixture, 'index.html');
    const home = readFileSync(homeOutput, 'utf8');
    assert.doesNotMatch(home, /MathJax|mathjax@|gtm\.js|GTM-KR7V8CX|ns\.html/);
    assert.equal((home.match(/gtag\/js\?id=G-N4LXQ0S6MC/g) ?? []).length, 1);
    assert.match(home, /gtag\("config", "G-N4LXQ0S6MC"\)/);
    const postOutput = join(fixture, 'posts/chordal-sdp/index.html');
    const post = readFileSync(postOutput, 'utf8');
    assert.ok(post.indexOf('window.MathJax =') < post.indexOf('id="MathJax-script"'));
    assert.equal((post.match(/id="MathJax-script"/g) ?? []).length, 1);
    assert.doesNotMatch(post, /<!-- mathjax: enabled -->/);
    assert.match(post, /\["\$", "\$"\]/);
    assert.match(post, /\["\\\\\(", "\\\\\)"\]/);

    const sourceFile = join(fixture, 'src/pages/index.html');
    const source = readFileSync(sourceFile, 'utf8');
    const enabled = source.replace('</head>', '  <!-- mathjax: enabled -->\n</head>');
    writeFileSync(sourceFile, enabled);
    assert.notEqual(run('--check').status, 0);
    assert.equal(run().status, 0);
    const enabledHome = readFileSync(homeOutput, 'utf8');
    assert.equal((enabledHome.match(/id="MathJax-script"/g) ?? []).length, 1);
    assert.ok(enabledHome.indexOf('window.MathJax =') < enabledHome.indexOf('id="MathJax-script"'));
    assert.equal(run('--check').status, 0);

    writeFileSync(sourceFile, enabled.replace('</head>', '  <!-- mathjax: enabled -->\n</head>'));
    const duplicate = run();
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /enabled more than once in index.html/);
    assert.equal(readFileSync(homeOutput, 'utf8'), enabledHome);

    writeFileSync(sourceFile, source);
    assert.equal(run().status, 0);
    assert.equal(readFileSync(homeOutput, 'utf8'), home);
    const partial = join(fixture, 'src/includes/mathjax.html');
    writeFileSync(partial, readFileSync(partial, 'utf8').replace('font-size: 1em', 'font-size: 1.05em'));
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /posts\/chordal-sdp\/index.html/);
    assert.equal(run().status, 0);
    assert.match(readFileSync(postOutput, 'utf8'), /font-size: 1\.05em/);
    assert.equal(run('--check').status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
