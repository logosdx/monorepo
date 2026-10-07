---
"@logosdx/localize": patch
"@logosdx/react": patch
---

CDN bundles no longer reference `process.env.NODE_ENV`

- `dist/browser/bundle.js` threw `ReferenceError: process is not defined` on a plain page: `@logosdx/react` at load, `@logosdx/localize` on a missing-key lookup. The build now inlines `process.env.NODE_ENV` as `"production"`, so the CDN bundles are production builds and the localize missing-key warning does not fire from them.
