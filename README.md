# Hong-Ming Chiu's website

The published site is static HTML. Navigation and footer markup are shared at
build time using a small Node.js script with no third-party dependencies.

## Editing

- Shared navigation: `src/includes/navigation.html`
- Shared footer content and social links: `src/includes/footer.html`
- Page content: `src/pages/`, mirroring the public paths (for example,
  `src/pages/index.html` and `src/pages/posts/chordal-sdp/index.html`)
- Styles, JavaScript, images, and PDFs: their existing directories

The `<footer>` wrapper, spacing, scroll-to-top controls, and post pagination
remain in each page template. Analytics and head metadata also remain there.
The resume redirect and Google verification HTML are standalone, ungenerated files.

## Build

Install Node.js 18 or later. No `npm install` is needed.

```sh
npm run build
```

This regenerates six HTML files **at their existing paths**, including root
`index.html`. Edit the sources in `src/`, not these generated files; each output
has a comment identifying its source. There is no `dist/` directory.

For automatic rebuilds on save:

```sh
npm run watch
```

To confirm the checked-in HTML matches its sources:

```sh
npm run check
```

Includes use `<!-- include: navigation.html -->` or
`<!-- include: footer.html -->` on a separate line. New HTML templates under
`src/pages/` are generated at the corresponding path from the repository root.
Includes cannot contain nested includes. The navigation has one supported token:
`{{ section-link: mybio }}` (and the other homepage section IDs). The build emits
the original `onclick="SmoothScrollToAnchorFix('mybio')"` on the homepage and
`href="/#mybio"` on other pages. This preserves homepage scrolling even when
previewed through a file URL or a server with a different base path. Other
template expressions are not supported.

## Preview and publish

Build first, then serve the **repository root**, not `src/`. For example, with Python 3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. Homepage section scrolling also works when opening
the generated homepage directly, but root-relative links between pages need an
HTTP server.

Before publishing, run `npm run build` and `npm run check`, then commit both the
source changes and generated HTML. Push as usual to your existing GitHub Pages
deployment. Generated pages stay checked in so hosting does not need Node.js or
a new deployment workflow. CSS, JavaScript, and image edits do not need an HTML
rebuild.
