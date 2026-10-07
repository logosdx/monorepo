---
"@logosdx/dom": patch
"@logosdx/fetch": patch
"@logosdx/hooks": patch
"@logosdx/localize": patch
"@logosdx/observer": patch
"@logosdx/state-machine": patch
"@logosdx/storage": patch
"@logosdx/utils": patch
---

CDN bundles no longer leak helper globals into page scope

- `dist/browser/bundle.js` declares nothing at page scope but the `LogosDx` namespace. Transpile helpers used to sit outside the IIFE as short `var` names, so a page script declaring the same name broke or altered the bundle.
- The browser bundle now targets es2022, with native class and private fields. This raises the CDN browser floor to about Chrome 84, Firefox 90, and Safari 15, matching the npm builds. `@logosdx/hooks` has no `.swcrc`, so its npm build is unchanged; only its CDN bundle moves to es2022.
