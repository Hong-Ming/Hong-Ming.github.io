# Building the website

Install the build dependencies once after checking out the repository:

```sh
npm ci
```

Edit page templates in `src/pages/`, shared navigation/footer in
`src/includes/`, entries in `src/data/`, and styles in `css/`.

```sh
npm run build   # Generate the public HTML and Font Awesome subsets
npm run watch   # Rebuild automatically after source HTML, JSON, or CSS changes
npm run check   # Check whether generated files match their sources
npm test       # Check the build's CSS and font handling
```

The build replaces each local stylesheet link with minified CSS in a `<style>`
element at the same position in the generated page. It preserves stylesheet
order, responsive rules, font metrics, and license banners, and adjusts font
and image URLs for each page's directory. External stylesheet links remain
external. `myscript.js` uses `defer` in the source templates.

Keep editing the original CSS and source HTML. Rebuild before publishing and
include the generated HTML, `css/fontawesome-subset.css`, and subset fonts in
your changes. Editing generated HTML directly will be overwritten next build.

Preview through a local HTTP server, for example `python3 -m http.server 8000`,
then open `http://localhost:8000/`. Watch mode rebuilds files; refresh your
browser to see changes.
