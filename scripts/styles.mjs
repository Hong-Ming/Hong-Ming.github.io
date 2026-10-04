import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { parse } from 'parse5';
import CleanCSS from 'clean-css';

const origin = 'https://build.invalid';
const escapeAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Replace each local stylesheet in place rather than moving it across existing
// inline styles or external sheets. This preserves the page's cascade order.
export function inlineStyles(root, page, generated = new Map()) {
  const edits = [];
  const document = parse(page.html, { sourceCodeLocationInfo: true });
  const pageUrl = new URL(page.name, origin + '/');
  function visit(node) {
    const attrs = new Map((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (node.tagName === 'base' && attrs.has('href')) {
      throw new Error(`CSS inlining does not support <base href> in ${page.name}.`);
    }
    const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
    if (node.tagName === 'link' && rel.includes('stylesheet') && attrs.has('href')
        && !rel.includes('alternate') && !attrs.has('disabled')) {
      const url = new URL(attrs.get('href'), pageUrl);
      if (url.origin === origin) {
        const path = resolve(root, '.' + decodeURIComponent(url.pathname));
        const name = relative(root, path);
        if (name.startsWith('..' + sep) || name === '..' || !name.endsWith('.css')) {
          throw new Error(`Invalid local stylesheet in ${page.name}: ${attrs.get('href')}`);
        }
        const css = generated.get(path) ?? readFileSync(path, 'utf8');
        const result = new CleanCSS({
          // Only optimize individual rules; do not merge/reorder rules or round
          // font metrics. Rebase assets to the HTML directory, including posts.
          level: { 1: { roundingPrecision: false, selectorsSortingMethod: false, specialComments: 'all' }, 2: false },
          rebaseTo: dirname(resolve(root, page.name)),
          inline: false,
        }).minify({ [path]: { styles: css } });
        if (result.errors.length || result.warnings.length) {
          throw new Error(`Cannot inline ${name} in ${page.name}: ${[...result.errors, ...result.warnings].join('; ')}`);
        }
        const kept = ['media', 'id', 'title', 'nonce', 'type'].filter((key) => attrs.has(key))
          .map((key) => ` ${key}="${escapeAttribute(attrs.get(key))}"`).join('');
        // A literal closing style tag inside CSS content would end the HTML
        // element; a CSS escape preserves its value without ending the tag.
        const styles = result.styles.replace(/<\/style/gi, (match) => '\\3c ' + match.slice(1));
        const { startOffset, endOffset } = node.sourceCodeLocation;
        edits.push({ startOffset, endOffset, output: `<style data-source="/${escapeAttribute(name.split(sep).join('/'))}"${kept}>${styles}</style>` });
      }
    }
    // Template contents are inert, so leave their link elements untouched.
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(document);
  let html = page.html;
  for (const edit of edits.sort((a, b) => b.startOffset - a.startOffset)) {
    html = html.slice(0, edit.startOffset) + edit.output + html.slice(edit.endOffset);
  }
  return html;
}
