import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEntries, renderEntries } from './entries.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = join(root, 'src/pages');
const includesDir = join(root, 'src/includes');
const checkOnly = process.argv.includes('--check');

function pageFiles(directory, includeData = false) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? pageFiles(path, includeData)
      : entry.name.endsWith('.html') || includeData && entry.name.endsWith('.json') ? [path] : [];
  }).sort();
}

// Includes occupy their own line; preserve that line's indentation in the output.
function render(source, pageName, collections) {
  const html = source.replace(/^([ \t]*)<!-- include: ([\w-]+\.html) -->[ \t]*$/gm, (_, indent, name) => {
    const partial = readFileSync(join(includesDir, name), 'utf8').trimEnd();
    if (partial.includes('<!-- include:')) {
      throw new Error(`Nested includes are not supported: ${name}`);
    }
    return partial.split('\n').map((line) => line ? indent + line : line).join('\n');
  });
  const withEntries = html.replace(/^([ \t]*)<!-- entries: ([\w-]+) -->[ \t]*$/gm, (_, indent, name) =>
    renderEntries(collections, name).split('\n').map((line) => line ? indent + line : line).join('\n')
  );
  // Preserve the original homepage click handlers independently of the preview
  // URL. Other pages need links back to the homepage's sections.
  return withEntries.replace(/\{\{ section-link: (myhom|mybio|myexp|mypublications) \}\}/g, (_, id) =>
    pageName === 'index.html'
      ? `onclick="SmoothScrollToAnchorFix('${id}')"`
      : `href="/#${id}"`
  );
}

function build() {
  const collections = loadEntries(root);
  // Render all sources before writing so a missing include cannot cause a partial build.
  const pages = pageFiles(pagesDir).map((source) => {
    const name = relative(pagesDir, source);
    const html = render(readFileSync(source, 'utf8'), name, collections);
    if (html.includes('<!-- include:') || html.includes('<!-- entries:')) throw new Error(`Unresolved build directive in ${name}`);
    const output = '<!-- Generated from src/pages/' + name + '; edit source and run npm run build. -->\n' + html;
    return { name, output, destination: join(root, name) };
  });
  const stale = [];
  for (const { name, output, destination } of pages) {
    if (checkOnly) {
      let current;
      try { current = readFileSync(destination, 'utf8'); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (current !== output) stale.push(name);
    } else {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, output);
    }
  }
  if (stale.length) throw new Error(`Generated pages are stale: ${stale.join(', ')}. Run npm run build.`);
  console.log(`${checkOnly ? 'Checked' : 'Built'} ${pages.length} pages.`);
}

try {
  build();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (process.argv.includes('--watch') && !checkOnly) {
  // Poll this small source tree so watch mode also works where native filesystem
  // watchers are unavailable (and on all platforms supported by Node.js 18).
  function snapshot() {
    return JSON.stringify(pageFiles(join(root, 'src'), true).map((path) => {
      const { mtimeMs, ctimeMs, size } = statSync(path);
      return [path, mtimeMs, ctimeMs, size];
    }));
  }
  let previous = snapshot();
  setInterval(() => {
    try {
      const current = snapshot();
      if (current !== previous) {
        previous = current;
        build();
      }
    } catch (error) {
      console.error(error.message);
    }
  }, 500);
  console.log('Watching src/ for changes. Press Ctrl+C to stop.');
}
