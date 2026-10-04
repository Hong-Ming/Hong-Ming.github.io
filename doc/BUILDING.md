# Building the website

Use Node.js 18.17+, 20.3+, or a newer supported release. Install the build
dependencies once after checking out the repository:

```sh
npm ci
```

Edit page templates in `src/pages/`, shared navigation/footer in
`src/includes/`, entries in `src/data/`, and styles in `css/`.

```sh
npm run build   # Generate public HTML, Font Awesome subsets, and responsive images
npm run watch   # Rebuild after source HTML, JSON, CSS, or original image changes
npm run check   # Check whether generated files match their sources
npm test       # Check the build's CSS, font, and image handling
```

The build replaces each local stylesheet link with minified CSS in a `<style>`
element at the same position in the generated page. It preserves stylesheet
order, responsive rules, font metrics, and license banners, and adjusts font
and image URLs for each page's directory. External stylesheet links remain
external. `myscript.js` uses `defer` in the source templates.

Google Analytics is installed directly on each page using `G-N4LXQ0S6MC`.

To render LaTeX equations on a page, put this marker on its own line inside
that page's `<head>` in `src/pages/` and rebuild:

```html
<!-- mathjax: enabled -->
```

The build expands the marker using `src/includes/mathjax.html`, with the
configuration before the loading script. The chordal-SDP post enables it;
the homepage currently does not download MathJax. The marker supports the
existing `$...$`, `\(...\)`, `$$...$$`, and `\[...\]` equation delimiters.

Keep editing the original CSS and source HTML. Rebuild before publishing and
include the generated HTML, `css/fontawesome-subset.css`, subset fonts, and `image/generated/` in
your changes. Editing generated HTML directly will be overwritten next build.

The homepage's photo and UIUC, NYCU, and USC logos use responsive image
attributes generated from `{{ image: myphoto }}` and `{{ image: uiuc_logo }}`
(and the other logo keys) in the source template. Replace their original files
in `image/` and rebuild to update the variants. The sizes and compression
settings are in `scripts/images.mjs`.

The photo gets 168px and 336px WebP versions. Logos get 40px, 80px, and 120px
versions; the build chooses the smaller of lossless PNG and lossless WebP for
each size. The originals remain unchanged. Logos load lazily; the profile
photo loads eagerly. Current CSS still controls their display sizes.

Preview through a local HTTP server, for example `python3 -m http.server 8000`,
then open `http://localhost:8000/`. Watch mode rebuilds files; refresh your
browser to see changes.
