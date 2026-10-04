import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

// Source images stay untouched. Widths cover the existing CSS sizes and
// high-density screens; lossless logo encodings preserve edges/transparency.
const definitions = [
  { key: 'myphoto', input: 'image/myphoto.jpg', widths: [168, 336], displayWidth: 168, displayHeight: 168, sizes: '168px' },
  ...['uiuc_logo', 'nycu_logo', 'usc_logo'].map((key) => ({
    key, input: `image/${key}.png`, widths: [40, 80, 120], displayWidth: 40, displayHeight: 40,
    sizes: '(max-width: 600px) 30px, 40px', logo: true,
  })),
];

export const imageInputs = definitions.map(({ input }) => input);

export async function renderResponsiveImages(root) {
  const images = await Promise.all(definitions.map(async (definition) => {
    const original = readFileSync(join(root, definition.input));
    const metadata = await sharp(original).metadata();
    const sourceWidth = [5, 6, 7, 8].includes(metadata.orientation) ? metadata.height : metadata.width;
    const widths = [...new Set(definition.widths.map((width) => Math.min(width, sourceWidth)))];
    const variants = await Promise.all(widths.map(async (width) => {
      const resized = sharp(original).rotate().resize({ width, withoutEnlargement: true });
      const webp = await resized.clone().webp(definition.logo
        ? { lossless: true, effort: 6 } : { quality: 82, effort: 6 }).toBuffer({ resolveWithObject: true });
      const png = definition.logo
        ? await resized.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true })
        : null;
      const encoded = png && png.data.length < webp.data.length ? png : webp;
      const stem = basename(definition.input, extname(definition.input));
      const name = `image/generated/${stem}-${encoded.info.width}.${encoded.info.format}`;
      return { name, destination: join(root, name), output: encoded.data, width: encoded.info.width, height: encoded.info.height };
    }));
    return { ...definition, originalBytes: original.length, variants };
  }));
  return { images, assets: images.flatMap(({ variants }) => variants) };
}

export function renderImageAttributes(images, key) {
  const image = images.find((image) => image.key === key);
  if (!image) throw new Error(`Unknown responsive image: ${key}`);
  const fallback = image.variants.find((variant) => variant.width >= (image.logo ? 80 : 168)) ?? image.variants.at(-1);
  return `src="/${fallback.name}" srcset="${image.variants.map((variant) => `/${variant.name} ${variant.width}w`).join(', ')}"`
    + ` sizes="${image.sizes}" width="${image.displayWidth}" height="${image.displayHeight}"`
    + (image.logo ? ' loading="lazy" decoding="async"' : ' loading="eager"');
}
