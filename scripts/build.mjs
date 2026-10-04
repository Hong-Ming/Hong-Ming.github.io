import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEntries, renderEntries } from './entries.mjs';
import { fontAwesomeInputs, renderFontAwesome } from './fontawesome.mjs';
import { renderFontAwesomeFonts } from './fontawesome-fonts.mjs';
import { inlineStyles } from './styles.mjs';
import { imageInputs, renderResponsiveImages, renderImageAttributes } from './images.mjs';

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
  let mathjaxIncluded = false;
  const html = source.replace(/^([ \t]*)<!-- (?:include: ([\w-]+\.html)|mathjax: enabled) -->[ \t]*$/gm, (_, indent, include) => {
    const name = include ?? 'mathjax.html';
    if (name === 'mathjax.html') {
      if (mathjaxIncluded) throw new Error(`MathJax is enabled more than once in ${pageName}.`);
      mathjaxIncluded = true;
    }
    const partial = readFileSync(join(includesDir, name), 'utf8').trimEnd();
    if (partial.includes('<!-- include:')) {
      throw new Error(`Nested includes are not supported: ${name}`);
    }
    return partial.split('\n').map((line) => line ? indent + line : line).join('\n');
  });
  const withEntries = html.replace(/^([ \t]*)<!-- entries: ([\w-]+) -->[ \t]*$/gm, (_, indent, name) =>
    renderEntries(collections, name).split('\n').map((line) => line ? indent + line : line).join('\n')
  );
  // Give crawlers and JavaScript-disabled browsers real section destinations.
  // Keep the homepage's animation without a competing native anchor jump.
  return withEntries.replace(/\{\{ section-link: (myhom|mybio|myexp|mypublications) \}\}/g, (_, id) =>
    pageName === 'index.html'
      ? `href="#${id}" onclick="SmoothScrollToAnchorFix('${id}'); return false;"`
      : `href="/#${id}"`
  );
}

async function build() {
  const collections = loadEntries(root);
  const responsive = await renderResponsiveImages(root);
  // Render all sources before writing so a missing include cannot cause a partial build.
  const pages = pageFiles(pagesDir).map((source) => {
    const name = relative(pagesDir, source);
    const html = render(readFileSync(source, 'utf8'), name, collections)
      .replace(/\{\{ image: ([\w-]+) \}\}/g, (_, key) => renderImageAttributes(responsive.images, key));
    if (html.includes('<!-- include:') || html.includes('<!-- entries:') || html.includes('<!-- mathjax:')) throw new Error(`Unresolved build directive in ${name}`);
    return { name, html, destination: join(root, name) };
  });
  const icons = renderFontAwesome(root, pages);
  const fonts = await renderFontAwesomeFonts(root, icons.fonts);
  // Use this build's icon CSS, not the previous generated file on disk.
  const generatedStyles = new Map([[icons.destination, icons.output]]);
  for (const page of pages) {
    page.output = '<!-- Generated from src/pages/' + page.name + '; edit source and run npm run build. -->\n'
      + inlineStyles(root, page, generatedStyles);
  }
  const stale = [];
  for (const { name, output, destination } of [...pages, icons, ...fonts, ...responsive.assets]) {
    if (checkOnly) {
      let current;
      try { current = readFileSync(destination); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (!current?.equals(Buffer.isBuffer(output) ? output : Buffer.from(output))) stale.push(name);
    } else {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, output);
    }
  }
  if (stale.length) throw new Error(`Generated files are stale: ${stale.join(', ')}. Run npm run build.`);
  const originalBytes = fonts.reduce((sum, font) => sum + font.originalBytes, 0);
  const subsetBytes = fonts.reduce((sum, font) => sum + font.output.length, 0);
  console.log(`${checkOnly ? 'Checked' : 'Built'} ${pages.length} pages with inline CSS and Font Awesome CSS (${icons.iconCount}/${icons.totalIconCount} icons); ${fonts.length} icon fonts: ${originalBytes} → ${subsetBytes} bytes.`);
  console.log(`Responsive images: ${responsive.assets.length} variants from ${responsive.images.length} originals.`);
}

try {
  await build();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (process.argv.includes('--watch') && !checkOnly) {
  // Poll this small source tree so watch mode also works where native filesystem
  // watchers are unavailable (and on all platforms supported by Node.js 18).
  function snapshot() {
    const css = readdirSync(join(root, 'css')).filter((name) => name.endsWith('.css') && name !== 'fontawesome-subset.css')
      .map((name) => join(root, 'css', name));
    // Exclude generated CSS to avoid rebuilding in response to our own output.
    const inputs = [...new Set([...pageFiles(join(root, 'src'), true), ...css,
      ...fontAwesomeInputs.map((path) => join(root, path)), ...imageInputs.map((path) => join(root, path))])].sort();
    return JSON.stringify(inputs.map((path) => {
      const { mtimeMs, ctimeMs, size } = statSync(path);
      return [path, mtimeMs, ctimeMs, size];
    }));
  }
  let previous = snapshot();
  let building = false;
  setInterval(async () => {
    if (building) return;
    try {
      const current = snapshot();
      if (current !== previous) {
        previous = current;
        building = true;
        await build();
      }
    } catch (error) {
      console.error(error.message);
    } finally {
      building = false;
    }
  }, 500);
  console.log('Watching src/, css/ sources, original images, and Font Awesome font inputs for changes. Press Ctrl+C to stop.');
}
