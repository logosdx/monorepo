---
"@logosdx/slides": patch
---

Republish from CI so the CDN paths resolve

- 0.1.0 was published from a local build, which puts `browser/` at the package root, so `dist/browser/slides.css` and `dist/browser/bundle.js` returned 404 on jsDelivr and unpkg. This release ships the standard `dist/` layout that the docs link to.
