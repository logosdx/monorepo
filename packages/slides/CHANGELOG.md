# @logosdx/slides

## 0.1.0

### Minor Changes

- 92db21f: New package: HTML-native presentation decks

  - `<slides>`, `<slide>`, and `<notes>` markup laid out by `dist/browser/slides.css`: columns snap sideways, panels snap down each column, and a panel taller than the screen scrolls instead of clipping. In print output each panel starts a new page, with every fragment shown.
  - `dist/browser/bundle.js` builds the deck on DOM ready; `<slides manual>` opts out. The npm entry exports `Deck` with no side effects.
  - Keyboard navigation (`→ ← ↓ ↑`, `Space`, `PageUp`/`PageDown`, `Home`/`End`), fullscreen, blank screen, and a help overlay. Keys aimed at form controls and editable elements are ignored.
  - Step-revealed `fragment` elements, URL hash sync with `#/<column>/<panel>/<fragment>` and `#<id>` deep links, and browser history per panel.
  - Speaker notes popup (`S`) with next-panel preview, position, and clocks; pressing `S` again reopens it after a reload.
  - Misplaced slides from unclosed `<p>`/`<li>` tags are repaired with a `console.warn`.
  - `Deck` API: `next()`, `prev()`, `nextColumn()`, `prevColumn()`, `goTo()`, `on()`, `destroy()`, with `deck:ready`, `slide:leave`, `slide:enter`, `fragment:show`, and `fragment:hide` events.

### Patch Changes

- Updated dependencies [92db21f]
  - @logosdx/dom@3.0.4
  - @logosdx/observer@2.5.4
  - @logosdx/utils@7.1.1
