import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import fontverter from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';

// The CSS renderer determines the exact codepoints used in each icon family.
// Keep original fonts as inputs and preserve attribution/license name records.
export async function renderFontAwesomeFonts(root, fonts) {
  const outputs = [];
  for (const font of fonts) {
    const original = readFileSync(join(root, font.input));
    const face = new Face(new Blob(await fontverter.convert(original, 'sfnt')));
    const available = new Set(face.collectUnicodes());
    const missing = font.codes.filter((code) => !available.has(code));
    if (missing.length) {
      throw new Error(`Icons ${missing.map((code) => `U+${code.toString(16).toUpperCase()}`).join(', ')} are unavailable in ${font.input}. Check the icon's fas/far/fab style.`);
    }
    const output = await subsetFont(original, String.fromCodePoint(...font.codes), {
      targetFormat: 'woff2',
      preserveNameIds: [0, 7, 8, 9, 10, 11, 13, 14],
    });
    outputs.push({ ...font, output, originalBytes: original.length });
  }
  return outputs;
}
